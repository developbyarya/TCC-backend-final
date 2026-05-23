# Art Bidding System API Documentation

This document describes all REST endpoints implemented in this project.

## Base URL

```
http://localhost:3000
```

## Auth

Most routes require a Bearer token:

```
Authorization: Bearer <JWT_TOKEN>
```

### Roles
- `SENIMAN` (artist)
- `KURATOR` (curator)
- `KOLEKTOR` (collector)

## Common Responses

- **401 Unauthorized** → missing/invalid token
- **403 Forbidden** → role not allowed
- **404 Not Found** → record not found

## Health Check

### GET `/health`
Checks service availability for Prisma (PostgreSQL) and Redis.

**Response 200**
```json
{
  "status": "ok",
  "checks": {
    "prisma": { "status": "ok" },
    "redis": { "status": "ok" }
  }
}
```

**Response 503**
```json
{
  "status": "degraded",
  "checks": {
    "prisma": { "status": "error", "error": "..." },
    "redis": { "status": "error", "error": "..." }
  }
}
```

---

# User Routes (`/user`)

### POST `/user/login`
Login using username or email.

**Body**
```json
{
  "username": "arya",
  "email": "arya@mail.com",
  "password": "secret"
}
```

**Response 200**
```json
{ "token": "<jwt>", "refreshToken": "<refresh_jwt>" }
```

### POST `/user/refresh`
Exchange a refresh token for a new access token (and rotate the refresh token). The request must include the refresh token in the request body.

**Body**
```json
{ "refreshToken": "<refresh_jwt>" }
```

The refresh token is a JWT that contains at minimum the following claims:
- `id` — the user id
- `role` — the user's role
- `jti` — a unique identifier for this refresh token (used for revocation/rotation)
- `type` — must be the string `"refresh"`

On success the server will:
- verify the refresh token and its `jti` exists in Redis under key `refresh:<userId>:<jti>`
- delete the old `jti` key from Redis
- issue a new refresh token with a new `jti` and persist it in Redis
- return a fresh access token and new refresh token

**Response 200**
```json
{ "token": "<new_access_jwt>", "refreshToken": "<new_refresh_jwt>" }
```

### POST `/user/logout`
Revoke a refresh token. The client must supply the `refreshToken` in the request body. The server will remove the corresponding `refresh:<userId>:<jti>` key from Redis so the refresh token can no longer be used.

**Body**
```json
{ "refreshToken": "<refresh_jwt>" }
```

**Response 200**
```json
{ "message": "Logged out" }
```

**Notes**
- Refresh tokens are stored server-side in Redis for revocation and rotation. Keys follow the pattern `refresh:<userId>:<jti>` and have a TTL matching the token expiry (30 days).
- If a refresh token is missing from Redis (revoked or expired), `/user/refresh` will return 401.
- Clients must provide the refresh token in the request body (not as Authorization header) when calling `/user/refresh` or `/user/logout`.

### POST `/user/register`
Register new user.

**Body**
```json
{
  "username": "arya",
  "full_name": "Arya Putra",
  "email": "arya@mail.com",
  "phone_number": "0812345678",
  "password": "secret",
  "role": "SENIMAN",
  "alt_name": "Anonymous"
}
```

**Response 201**
```json
{ "id": "<user_id>" }
```

### GET `/user/profile`
Get current user profile (requires auth).

**Response 200**
```json
{
  "user": {
    "id": "<user_id>",
    "username": "arya",
    "full_name": "Arya Putra",
    "email": "arya@mail.com",
    "phone_number": "0812345678",
    "role": "SENIMAN",
    "alt_name": "Anonymous"
  }
}
```

### PUT `/user/update/profile`
Update profile (requires auth).

**Body**
```json
{
  "full_name": "Arya Putra",
  "alt_name": "Anonymous"
}
```

### PUT `/user/update/password`
Change password (requires auth).

**Body**
```json
{
  "password": "new_secret"
}
```

### DELETE `/user/delete`
Delete account (requires auth).

---

# Artwork Routes (`/karya-seni`)

### POST `/karya-seni/create`
Create artwork (requires `SENIMAN`).

**Body**
```json
{
  "nama_karya": "Sunset",
  "deskripsi": "Oil on canvas",
  "katalog": "Modern",
  "tags": "oil,canvas,sunset",
  "min_bid_ammount": 1000,
  "open_bid_time": "2026-05-16T10:00:00Z",
  "close_bid_time": "2026-05-20T10:00:00Z"
}
```

**Note**
- Image is uploaded separately via `POST /karya-seni/:id/image`.
- After upload, the artwork will have `image_url` filled.

### GET `/karya-seni/all`
List artworks, optional katalog filter.

**Query**
```
?katalog=Modern,Classic
```

### GET `/karya-seni/:id`
Get artwork details.

**Response includes**
- `image_url` (string, nullable)
- `artist` (object)

**Response 200**
```json
{
  "id": "<artwork_id>",
  "nama_karya": "Sunset",
  "deskripsi": "Oil on canvas",
  "katalog": "Modern",
  "tags": "oil,canvas,sunset",
  "image_url": "https://...",
  "verification_status": "UNVERIFIED",
  "min_bid_ammount": 1000,
  "open_bid_time": "2026-05-16T10:00:00Z",
  "close_bid_time": "2026-05-20T10:00:00Z",
  "artistId": "<artist_id>",
  "ownerId": null,
  "artist": {
    "id": "<artist_id>",
    "username": "arya",
    "full_name": "Arya Putra",
    "email": "arya@mail.com",
    "phone_number": "0812345678",
    "role": "SENIMAN",
    "alt_name": "Anonymous"
  }
}
```

### PUT `/karya-seni/:id/owns`
Update ownership to current user (requires auth).

### PUT `/karya-seni/:id/detail`
Update artwork details (requires `SENIMAN`, only owner/artist).

### DELETE `/karya-seni/:id/delete`
Delete artwork (requires `SENIMAN` or `KURATOR`).

### PUT `/karya-seni/:id/verify`
Verify artwork (requires `KURATOR`).

### PUT `/karya-seni/:id/unverify`
Unverify artwork (requires `KURATOR`).

### POST `/karya-seni/:id/image`
Upload artwork image to GCS (requires `SENIMAN`).

**Content-Type**
`multipart/form-data`

**Form Data**
- `image` (file, required)

**Response 200**
```json
{
  "artwork": {
    "id": "<artwork_id>",
    "image_url": "https://storage.googleapis.com/<bucket>/artworks/<file>.jpg"
  },
  "image_url": "https://storage.googleapis.com/<bucket>/artworks/<file>.jpg",
  "gs_uri": "gs://<bucket>/artworks/<file>.jpg"
}
```

---

# Bidding Routes (`/bid`)

### POST `/bid/new`
Create new bid (requires auth).

**Body**
```json
{
  "artworks_id": "<artwork_id>",
  "ammount": 1200
}
```

### PUT `/bid/:id/cancle`
Cancel bid (requires auth).

### GET `/bid/:id/detail`
Get bid detail (requires auth).

### GET `/bid/low-high`
Get lowest and highest bid (requires auth).

**Note:** The server caches the result of this endpoint in Redis for a short period (30 seconds) to speed up repeated requests. Responses within the cache window may be slightly stale.

### GET `/bid`
Get all bids (requires auth).

---

# Wishlist Routes (`/wishlisht`)

These endpoints let authenticated users maintain a personal wishlist of artworks. The wishlist is stored in Redis as a set under the key `wishlist:<userId>`.

### GET `/wishlisht`
Get the current user's wishlist (requires auth).

**Response 200**
```json
{
  "wishlist": [
    {
      "id": "<artwork_id>",
      "nama_karya": "Sunset",
      "deskripsi": "Oil on canvas",
      "katalog": "Modern",
      "image_url": "https://...",
      "min_bid_ammount": 1000
    }
  ]
}
```

### POST `/wishlisht`
Add an artwork to the current user's wishlist (requires auth).

**Body**
```json
{ "artworkId": "<artwork_id>" }
```

**Response 201**
```json
{ "message": "Added to wishlist" }
```

### DELETE `/wishlisht/:artworkId`
Remove an artwork from the current user's wishlist (requires auth).

**Response 200**
```json
{ "message": "Removed from wishlist" }
```

**Notes**
- Wishlist is persisted in Redis (no TTL by default). If you need persistence beyond Redis lifecycle, consider backing up or using a DB-backed wishlist.
- When an artwork is deleted from the database it may still appear in users' wishlist sets until cleaned up; consider adding cleanup logic if needed.

# Payments Routes (`/payments`)

### POST `/payments`
Create new payment (requires auth).

**Body**
```json
{
  "ammounts": 1500,
  "fee": 0.035,
  "for_bid": "<bid_id>"
}
```

### GET `/payments`
List payment history for current user (requires auth).
