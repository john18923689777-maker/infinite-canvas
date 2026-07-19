import { test, expect, type Page } from '@playwright/test'

const canvasA = required('CANVAS_A_URL')
const canvasB = required('CANVAS_B_URL')
const parentA = required('PARENT_A_URL')
const parentB = required('PARENT_B_URL')
const keyA = required('STAGING_KEY_A')
const keyB = required('STAGING_KEY_B')
const bananaModel = required('NANO_BANANA_MODEL')

const sensitiveKeys = ['token', 'user_id', 'src_host', 'src_url', 'apiKey', 'baseUrl', 'agentUrl', 'agentToken']

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

async function responseHeaders(page: Page, url: string) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' })
  expect(response, `response for ${url}`).not.toBeNull()
  return response!.headers()
}

async function assertFrameContract(page: Page, parent: string, canvas: string, otherCanvas: string) {
  const parentHeaders = await responseHeaders(page, parent)
  const parentCsp = parentHeaders['content-security-policy'] || ''
  expect(parentCsp).toContain('frame-src')
  expect(parentCsp).toContain(new URL(canvas).origin)
  expect(parentCsp).not.toContain(new URL(otherCanvas).origin)

  const canvasResponse = await page.request.get(canvas)
  const canvasHeaders = canvasResponse.headers()
  expect(canvasHeaders['content-security-policy'] || '').toContain(`frame-ancestors ${new URL(parent).origin}`)
  expect(canvasHeaders['x-frame-options']).toBeUndefined()

  const frameUrl = `${canvas}/image?theme=light&lang=zh-CN&ui_mode=embedded`
  await page.evaluate((src) => {
    document.body.replaceChildren()
    const iframe = document.createElement('iframe')
    iframe.id = 'canvas-acceptance-frame'
    iframe.src = src
    document.body.appendChild(iframe)
  }, frameUrl)
  const frame = page.frame({ url: /\/image\?/ })
  await expect.poll(() => frame?.url() || '').toContain(new URL(canvas).origin)
  const rendered = new URL(frame!.url())
  for (const key of sensitiveKeys) expect(rendered.searchParams.has(key)).toBe(false)
  expect(Array.from(rendered.searchParams.keys()).sort()).toEqual(['lang', 'theme', 'ui_mode'])
}

async function generateOpenAI(page: Page) {
  return page.evaluate(async ({ key }) => {
    const response = await fetch('/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-2', prompt: 'small browser persistence acceptance image', n: 1, response_format: 'b64_json' }),
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(`OpenAI generation failed: ${response.status}`)
    const encoded = payload?.data?.[0]?.b64_json
    if (!encoded) throw new Error('OpenAI generation returned no b64_json')
    return { encoded, mimeType: 'image/png' }
  }, { key: keyA })
}

async function generateGemini(page: Page) {
  return page.evaluate(async ({ key, model }) => {
    const response = await fetch(`/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'small browser persistence acceptance image' }] }], generationConfig: { responseModalities: ['IMAGE'] } }),
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(`Gemini generation failed: ${response.status}`)
    const parts = payload?.candidates?.flatMap((candidate: any) => candidate?.content?.parts || []) || []
    const inline = parts.map((part: any) => part?.inlineData || part?.inline_data).find((item: any) => item?.data)
    if (!inline?.data) throw new Error('Gemini generation returned no inlineData')
    return { encoded: inline.data, mimeType: inline.mimeType || inline.mime_type || 'image/png' }
  }, { key: keyB, model: bananaModel })
}

async function openDb(page: Page, stores: string[]) {
  await page.evaluate(async (requiredStores) => {
    const inspect = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('infinite-canvas')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const missing = requiredStores.filter((store) => !inspect.objectStoreNames.contains(store))
    const nextVersion = inspect.version + (missing.length ? 1 : 0)
    inspect.close()
    if (!missing.length) return
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('infinite-canvas', nextVersion)
      request.onupgradeneeded = () => missing.forEach((store) => request.result.objectStoreNames.contains(store) || request.result.createObjectStore(store))
      request.onsuccess = () => { request.result.close(); resolve() }
      request.onerror = () => reject(request.error)
    })
  }, stores)
}

async function persistGeneratedImage(page: Page, instance: string, encoded: string, mimeType: string) {
  await openDb(page, ['image_files', 'app_state'])
  return page.evaluate(async ({ instance, encoded, mimeType }) => {
    const bytes = Uint8Array.from(atob(encoded), (value) => value.charCodeAt(0))
    const imageKey = `image:browser-smoke:${instance}`
    const projectKey = 'infinite-canvas:canvas_store'
    const project = JSON.stringify({ state: { projects: [{ id: `browser-smoke-${instance}`, title: instance, nodes: [{ metadata: { storageKey: imageKey } }] }] }, version: 0 })
    const write = (storeName: string, key: string, value: unknown) => new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('infinite-canvas')
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction(storeName, 'readwrite')
        tx.objectStore(storeName).put(value, key)
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
      request.onerror = () => reject(request.error)
    })
    await write('image_files', imageKey, new Blob([bytes], { type: mimeType }))
    await write('app_state', projectKey, project)
    return { imageKey, projectKey }
  }, { instance, encoded, mimeType })
}

async function readStored(page: Page, storeName: string, key: string) {
  return page.evaluate(({ storeName, key }) => new Promise<any>((resolve, reject) => {
    const request = indexedDB.open('infinite-canvas')
    request.onsuccess = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(storeName)) { db.close(); resolve(undefined); return }
      const tx = db.transaction(storeName)
      const get = tx.objectStore(storeName).get(key)
      get.onsuccess = () => { db.close(); resolve(get.result) }
      get.onerror = () => reject(get.error)
    }
    request.onerror = () => reject(request.error)
  }), { storeName, key })
}

async function deleteStored(page: Page, storeName: string, key: string) {
  await page.evaluate(({ storeName, key }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('infinite-canvas')
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction(storeName, 'readwrite')
      tx.objectStore(storeName).delete(key)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => reject(tx.error)
    }
    request.onerror = () => reject(request.error)
  }), { storeName, key })
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`iframe and CSP contracts hold at ${viewport.width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport })
    await assertFrameContract(await context.newPage(), parentA, canvasA, canvasB)
    await assertFrameContract(await context.newPage(), parentB, canvasB, canvasA)
    await context.close()
  })
}

test('generated image blobs and projects persist locally and stay origin-isolated', async ({ browser }) => {
  const context = await browser.newContext()
  const pageA = await context.newPage()
  await pageA.goto(`${canvasA}/image`, { waitUntil: 'domcontentloaded' })
  const generatedA = await generateOpenAI(pageA)
  const storedA = await persistGeneratedImage(pageA, '55ai', generatedA.encoded, generatedA.mimeType)
  await pageA.reload({ waitUntil: 'domcontentloaded' })
  expect(await readStored(pageA, 'image_files', storedA.imageKey)).toBeInstanceOf(Object)
  expect(String(await readStored(pageA, 'app_state', storedA.projectKey))).toContain('browser-smoke-55ai')

  const pageB = await context.newPage()
  await pageB.goto(`${canvasB}/image`, { waitUntil: 'domcontentloaded' })
  expect(await readStored(pageB, 'image_files', storedA.imageKey)).toBeUndefined()
  const generatedB = await generateGemini(pageB)
  const storedB = await persistGeneratedImage(pageB, 'ai16888', generatedB.encoded, generatedB.mimeType)
  await pageB.reload({ waitUntil: 'domcontentloaded' })
  expect(await readStored(pageB, 'image_files', storedB.imageKey)).toBeInstanceOf(Object)
  expect(String(await readStored(pageB, 'app_state', storedB.projectKey))).toContain('browser-smoke-ai16888')
  expect(await readStored(pageB, 'image_files', storedA.imageKey)).toBeUndefined()

  await deleteStored(pageA, 'image_files', storedA.imageKey)
  await deleteStored(pageA, 'app_state', storedA.projectKey)
  expect(await readStored(pageA, 'image_files', storedA.imageKey)).toBeUndefined()
  await deleteStored(pageB, 'image_files', storedB.imageKey)
  await deleteStored(pageB, 'app_state', storedB.projectKey)
  expect(await readStored(pageB, 'image_files', storedB.imageKey)).toBeUndefined()

  await pageA.evaluate(() => indexedDB.deleteDatabase('infinite-canvas'))
  await pageB.evaluate(() => indexedDB.deleteDatabase('infinite-canvas'))
  await context.close()
})

test('disabled routes fail closed and canvas URLs contain no sensitive context', async ({ page }) => {
  await page.goto(`${canvasA}/video?token=secret&user_id=1&src_host=x&src_url=y&apiKey=z`, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/image/)
  for (const key of sensitiveKeys) expect(new URL(page.url()).searchParams.has(key)).toBe(false)
  await page.goto(`${canvasB}/config?baseUrl=https://evil.example&agentToken=secret`, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/image/)
  for (const key of sensitiveKeys) expect(new URL(page.url()).searchParams.has(key)).toBe(false)
})
