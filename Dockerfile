# --- Stage 1: Build ---
# שינוי גרסה: מ-18 ל-22 (LTS עדכני)
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# --- Stage 2: Production Run ---
# גם כאן משדרגים ל-22
FROM node:22-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --only=production

COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/apps/track-me/main"]