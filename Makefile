IMAGES := $(shell docker images -f "dangling=true" -q)
CONTAINERS := $(shell docker ps -a -q -f status=exited)
VOLUME := md-pdf2json-data
VERSION := 0.1
REPOSITORY := osc.repo.kopla.jyu.fi
IMAGE := md-pdf2json


clean:
	docker rm -f $(CONTAINERS)
	docker rmi -f $(IMAGES)

build:
	docker build -t $(REPOSITORY)/messydesk/$(IMAGE):$(VERSION) .

start:
	docker run -d --name $(IMAGE) \
		-v $(VOLUME):/logs \
		-p 9000:9000 \
		--restart unless-stopped \
		$(REPOSITORY)/messydesk/$(IMAGE):$(VERSION)

restart:
	docker stop $(IMAGE)
	docker rm $(IMAGE)
	$(MAKE) start

bash:
	docker exec -it $(IMAGE) bash
