FROM node:10

MAINTAINER Trocafone Tech Payments "tech-payments@trocafone.com"

ARG FURY_TOKEN=token

WORKDIR /src

RUN echo "//npm-proxy.fury.io/trocafone/:_authToken=${FURY_TOKEN}" > ~/.npmrc
RUN echo "registry: \"//npm-proxy.fury.io/trocafone/\"" >> ~/.npmrc
RUN echo "always-auth=true" >> ~/.npmrc
RUN echo "registry \"https://npm-proxy.fury.io/trocafone/\"" > ~/.yarnrc

COPY ./package.json /src
COPY ./yarn.lock /src

RUN yarn install --frozen-lockfile

COPY . /src

CMD ["node","fix_pending_cancel.js"]