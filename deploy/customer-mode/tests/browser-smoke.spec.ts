import { test, expect } from '@playwright/test'

const canvasA = process.env.CANVAS_A_URL
const canvasB = process.env.CANVAS_B_URL
const parentA = process.env.PARENT_A_URL
const parentB = process.env.PARENT_B_URL

test.skip(!canvasA || !canvasB || !parentA || !parentB, 'staging browser URLs are required')

test('customer canvas routes and browser origins stay isolated', async ({ browser }) => {
  const contextA = await browser.newContext()
  const pageA = await contextA.newPage()
  await pageA.goto(`${canvasA}/video`, { waitUntil: 'domcontentloaded' })
  await expect(pageA).toHaveURL(/\/image/)
  await pageA.goto(`${canvasA}/config`, { waitUntil: 'domcontentloaded' })
  await expect(pageA).toHaveURL(/\/image/)
  await pageA.evaluate(() => localStorage.setItem('customer-smoke', 'a'))
  expect(await pageA.evaluate(() => localStorage.getItem('customer-smoke'))).toBe('a')
  await contextA.close()

  const contextB = await browser.newContext()
  const pageB = await contextB.newPage()
  await pageB.goto(`${canvasB}/image`, { waitUntil: 'domcontentloaded' })
  expect(await pageB.evaluate(() => localStorage.getItem('customer-smoke'))).toBeNull()
  await contextB.close()
})
