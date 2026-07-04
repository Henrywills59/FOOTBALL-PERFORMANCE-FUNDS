FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY shared/package.json shared/package.json
COPY frontend/package.json frontend/package.json
RUN npm install

COPY shared shared
COPY frontend frontend
RUN npm run build -w shared && npm run build -w frontend

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY frontend/package.json frontend/package.json
RUN npm install --omit=dev

COPY --from=build /app/frontend/dist frontend/dist

EXPOSE 5173
CMD ["npm", "run", "preview", "-w", "frontend", "--", "--port", "5173"]
