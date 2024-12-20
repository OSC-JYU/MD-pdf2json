


PDF to JSON

	curl -X POST -H "Content-Type: multipart/form-data" \
	  -F "request=@test/pdf2json.json;type=application/json" \
	  -F "content=@test/sample.pdf" \
	  http://localhost:9000/process

