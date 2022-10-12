FROM mhart/alpine-node:4

WORKDIR /opt/fronts

RUN npm config set unsafe-perm true && \
    apk update && apk upgrade && apk --update add \
    ruby-dev ruby-bundler build-base libffi-dev \
    libstdc++ tzdata bash git tar \
    ca-certificates openssl wget \
    &&  echo 'gem: --no-document' > /etc/gemrc \
    && gem install compass \
    && npm install -g grunt-cli \
    && echo '{ "allow_root": true }' > /root/.bowerrc

COPY . /opt/fronts