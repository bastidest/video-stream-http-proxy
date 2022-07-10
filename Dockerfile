FROM node:18.3.0
COPY --from=mwader/static-ffmpeg:5.0.1-3 /ffmpeg /usr/local/bin/

ENV NODE_ENV=development
RUN mkdir /app && chown node:node /app
USER node
WORKDIR /app
# COPY --chown=node package.json package-lock.json /app/
# RUN npm install
