FROM    node:alpine
WORKDIR /src
COPY    package.json /src
RUN     npm install
COPY    app.js /src
EXPOSE  1664
CMD     ["node","app.js"]
