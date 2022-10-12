#!/bin/sh

cd $2

echo "++++++++++ INSTALL +++++++++++"
npm install

echo "++++++++++ BUILD +++++++++++"
grunt build

if [ "$1" == "production" ]; then
    echo "deploying production"
    grunt publish
fi

if [ "$1" == "staging" ]; then
    echo "deploying staging"
    grunt publish-stg
fi
