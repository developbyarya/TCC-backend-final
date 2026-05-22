# API ROUTES FOR ART BIDDING SYSTEM

## USER (/user/)
### STRUCTURE
- ID
- username*
- full_name
- email*
- phone number*
- password*
- role* : ["SENIMAN", "KURATOR", "KOLEKTOR"]
- alt_name // For artist who hid their real name

*mandatory field

### ROUTES 
1. Login (/user/login) -> POST username/email, password
2. REGISTER (/user/register) -> POST ALL FIELD
3. GET PROFILE (/user/profile) -> GET (Bearer token)
4. PUT (/user/update/profile) -> Update Profile full_name, alt_name
5. CHANGE PASSWORD (/user/update/profile) -> PUT  
6. DELETE ACCOUNT (/user/delte)

## ARTWORKS (/karya-seni)
### STRUCTURE
- ID
- nama_karya* -> string
- deskripsi -> string, rich text
- katalog -> string
- tags -> string separate by commas
- verification_status* : ["VERIFIED", "UNVERIFIED"] # default unverified
- artist* -> FK to user (only artist/SENIMAN)
- owner -> FK to user (only collector/KOLEKTOR) non empty field meaning its owned
- min_bid_ammount* -> INT
- open_bid_time -> TIMESTAMP
- close_bid_time -> TIMESTAMP

### ROUTES
1. CREATE ARTS (/karya-seni/create) -> POST
2. Get ALL karya seni (/karya-seni/all) -> GET, can filter by katalog (multiple katalog)
3. GET DETAIL INFO (/karya-seni/:id) -> GET
4. UPDATE OWNERSHIP (/karya-seni/:id/owns) -> PUT
5. UPDATE detail karya (/karya-seni/:id/detail) -> PUT only by artist
6. DELETE karya seni (/karya-seni/:id/delete) -> ONLY BY artist or CURATOR
7. VERIFY karya seni (/karya-seni/:id/verify) -> ONLY BY CURATOR ROLE
8. UNVERIFY karya seni (/karya-seni/:id/unverify) -> ONLY BY CURATOR ROLE

## BIDDING (/bid)
### STRUCTURE

### ROUTES
1. CREATE NEW BID (/bid/new)
2. CANCLE BID (/bid/:id/cancle)
3. BID DETAIL (/bid/:id/detail)
4. BID LOW/HIGH (/bid/low-high)
5. ALL BID (/bid)

## PAYMENTS (/payments/)
### STRUCTURE
1. *ID
2. *ammounts
3. *fee DEFAULT 3.5%
4. *FOR_BID: FK to bids
5. *paid_by: FK to users
6. TIMESTAMPS

### ROUTES
1. CREATE NEW PAYMENTS (POST /payments)
2. READ ALL PAYMENTS HISTORY (GET /payments) -> only for that user 




## WISHLIST (/wishlist)
### PURPOSE
Allow authenticated users to save artwork they like for quick access later.

### STORAGE
- Wishlists are stored in Redis as sets under key `wishlist:<userId>`.

### ROUTES
1. GET `/wishlist` -> returns full artwork objects in the user's wishlist (requires Bearer token)
2. POST `/wishlist` -> add artwork to wishlist. Body: `{ "artworkId": "<id>" }`
3. DELETE `/wishlist/:artworkId` -> remove artwork from wishlist

### NOTES
- The wishlist is not persisted outside Redis by default. If Redis is flushed, wishlists will be lost. Consider adding persistence if needed.
- Artwork deletions are not automatically propagated to wishlists; consider cleanup logic if desired.

*mandatory field