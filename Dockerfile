FROM node:24.22.1
MAINTAINER Johnny Blaesta<johnny.blasta@sundsvall.se>
RUN curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add -
RUN curl https://packages.microsoft.com/config/debian/9/prod.list > /etc/apt/sources.list.d/mssql-release.list
RUN apt-get update
RUN ACCEPT_EULA=Y apt-get install -y msodbcsql18
RUN ACCEPT_EULA=Y apt-get install -y mssql-tools18
RUN echo 'export PATH="$PATH:/opt/mssql-tools18/bin"' >> ~/.bashrc
RUN apt-get install -y unixodbc-dev
RUN apt-get install -y libgssapi-krb5-2
RUN mkdir /OrigoServer
WORKDIR /OrigoServer
COPY ./kod/ ./
COPY /srv/shared/docker/config/config.js ./conf/config.js
# sqlite3 kompileras här, eftersom den färdiga binären för sqlite3 6 kräver glibc 2.38
# och bookworm har 2.36.
RUN npm install --build-from-source=sqlite3
RUN mkdir /db
ENTRYPOINT npm start
EXPOSE 3001
