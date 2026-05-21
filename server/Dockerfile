# 联机肉鸽塔防 — 服务端 Docker 镜像
# ---------------------------------------------------------------
# 多阶段构建：
#   stage 1 (builder): 安装依赖（含 optionalDependencies）
#   stage 2 (runtime): 仅保留 production 依赖与源码
#
# 构建：docker build -t rtd-server:latest -f server/Dockerfile .
# 运行：docker run -d -p 8765:8765 -e MONGO_URL=... rtd-server:latest

FROM node:18-alpine AS builder

WORKDIR /app

# 先拷依赖描述 → 利用 Docker 缓存
COPY shared/package.json shared/tsconfig.esm.json shared/tsconfig.cjs.json /app/shared/
COPY shared/src /app/shared/src
RUN cd /app/shared && npm install --no-audit --no-fund && npm run build

COPY server/package.json /app/server/
RUN cd /app/server && npm install --no-audit --no-fund --omit=dev || \
    cd /app/server && npm install --no-audit --no-fund

COPY server/src /app/server/src

# ---- runtime stage ----
FROM node:18-alpine

WORKDIR /app

# 安装 dumb-init 处理 PID1 信号
RUN apk add --no-cache dumb-init

COPY --from=builder /app/shared /app/shared
COPY --from=builder /app/server /app/server

# 健康检查（每 30s 检查端口）
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD node -e "require('net').createConnection(${PORT:-8765}, '127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"

ENV NODE_ENV=production
ENV PORT=8765
EXPOSE 8765

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "/app/server/src/index.js"]
