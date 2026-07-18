# Video Integration Deferred

Video remains intentionally hidden in the customer build. The canvas client currently expects `/v1/videos`, `/v1/videos/{id}` and `/v1/videos/{id}/content`, while Sub2API exposes `/v1/videos/generations`. A future adapter must cover create, polling, content retrieval, cancellation, errors, billing and both independent upstream mappings before the video route is enabled.
