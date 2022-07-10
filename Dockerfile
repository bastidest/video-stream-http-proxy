ARG DOCKER_FFMPEG_VERSION
FROM mwader/static-ffmpeg${DOCKER_FFMPEG_VERSION} as ffmpeg

ARG DOCKER_NODE_VERSION
FROM node${DOCKER_NODE_VERSION}
COPY --from=ffmpeg /ffmpeg /usr/local/bin/

ENV NODE_ENV=production
RUN mkdir /app && chown node:node /app
USER node
WORKDIR /app

COPY --chown=node package.json package-lock.json /app/
RUN npm install

COPY --chown=node . /app/

CMD [ "npm", "start" ]
