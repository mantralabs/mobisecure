#!/bin/bash

echo "the script starts now"

kill -9 $(lsof -i:3000 -t)

nohup node app.js &

echo "restarted. Hurrey!!"

