FROM    node:9-alpine
RUN     apk add --no-cache python make
WORKDIR /src
COPY    package.json package-lock.json /src/
RUN     npm install
COPY    app.js /src
EXPOSE  1664
CMD     ["node","app.js"]
