# One container for the whole site: builds the public site and admin, then FastAPI serves them with the API.
FROM node:20-slim AS web
WORKDIR /src
COPY frontend/package*.json frontend/
COPY admin/package*.json admin/
RUN npm ci --prefix frontend && npm ci --prefix admin
COPY frontend frontend
COPY admin admin
COPY backend/app/data backend/app/data
ARG SITE_URL=https://www.yerevanrestaurant.nl
ENV SITE_URL=$SITE_URL
RUN npm run build --prefix frontend && npm run build --prefix admin

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY --from=web /src/frontend/dist ./static
ENV PORT=8000 STATIC_DIR=/app/static
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
