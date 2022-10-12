FROM mhart/alpine-node:8.14.0

MAINTAINER Trocafone Tech Payments "tech-payments@trocafone.com"

ARG hash=dev
ARG branch=dev
ARG FURY_TOKEN=token
LABEL com.trocafone.commit_hash=$hash
LABEL com.trocafone.branch=$branch

ENV TROCA_APP_NAME='payment-api'
ENV TROCA_APP_PATH='/opt/payment-api'

WORKDIR /opt/payment-api

COPY ./api/package.json ./

RUN echo "//npm-proxy.fury.io/trocafone/:_authToken=${FURY_TOKEN}" > ~/.npmrc
RUN echo "registry: \"//npm-proxy.fury.io/trocafone/\"" >> ~/.npmrc
RUN echo "always-auth=true" >> ~/.npmrc
RUN echo "registry \"https://npm-proxy.fury.io/trocafone/\"" > ~/.yarnrc

RUN npm config set unsafe-perm true && \
    apk add --no-cache --virtual .build-deps make gcc g++ python \
	&& yarn install --frozen-lockfile \
	&& apk del .build-deps

COPY ./api ./
COPY ./docs/api-documentation/schemas ./src/schemas
COPY ./env/newrelic.js ./

VOLUME ./logs

RUN yarn run build

ENTRYPOINT ["/opt/payment-api/entrypoint.sh"]
CMD ["start", "development"]