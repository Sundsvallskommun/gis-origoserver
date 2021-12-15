FROM node:14
MAINTAINER Johnny Blaesta<johnny.blasta@sundsvall.se>
RUN mkdir /OrigoServer
WORKDIR /OrigoServer
COPY ./kod/ ./
RUN npm install
RUN mkdir /db
ENTRYPOINT npm start
EXPOSE 3001
