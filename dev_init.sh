# Softlink the schemas folder to the api root.
if [ ! -d ./api/schemas ]; then
	echo "Making softlink to schemas folder"
	(cd api; ln -s ../docs/api-documentation/schemas .)
	echo "\n\n"
else
	echo "Schemas already copied\n\n"
fi

# Run migrations
echo "Running migrations"
./db/flyway migrate
echo "\n\n"

# Run api
echo "Running api"
(cd api; npm install; npm start)