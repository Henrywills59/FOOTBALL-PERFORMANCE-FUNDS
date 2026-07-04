FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY shared/package.json shared/package.json
COPY database/package.json database/package.json
COPY backend/package.json backend/package.json
RUN npm install

COPY shared shared
COPY database database
COPY backend backend
RUN npm run build -w shared && npm run build -w database && npm run build -w backend

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY shared/package.json shared/package.json
COPY database/package.json database/package.json
COPY backend/package.json backend/package.json
RUN npm install --omit=dev

COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/database/prisma database/prisma
COPY --from=build /app/backend/dist backend/dist

EXPOSE 3000
CMD ["npm", "run", "start", "-w", "backend"]
