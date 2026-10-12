# Development Direct Access

For local development only, set `DEV_BYPASS_AUTH=true` in `.env` and keep `APP_ENV=local`.

The development middleware exposes a virtual development identity (`admin`, role `owner`) through the request attributes. Do not enable this setting in staging or production.
