FROM node:15.14.0-buster

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY server.js .
COPY monitor monitor 

CMD [ "npm", "start"]
