FROM node:14
MAINTAINER Johnny Blaesta<johnny.blasta@sundsvall.se>
RUN mkdir /OrigoServer
WORKDIR /OrigoServer
COPY ./kod/ ./
COPY /srv/shared/docker/config/config.js ./conf/config.js
RUN npm install
RUN mkdir /db
ENTRYPOINT npm start
EXPOSE 3001
