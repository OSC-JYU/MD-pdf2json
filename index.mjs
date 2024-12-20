import Koa from 'koa';
import Router from '@koa/router';
import { bodyParser } from '@koa/bodyparser';
import json from 'koa-json'
import PDFParser from "pdf2json"; 

import { createWriteStream } from "fs";
import fs from "fs";
import fse from 'fs-extra'
import { v4 as uuidv4 } from 'uuid';
import path from 'path'

import multer from '@koa/multer';


var app				= new Koa();
var router			= new Router();

app.use(json({ pretty: true, param: 'pretty' }))
app.use(bodyParser());

const upload = multer({
	dest: './uploads/',
	fileSize: 1048576
});

const pdfParser = new PDFParser();

// ******* ROUTES ************

router.get('/', function (ctx) {
	ctx.body = 'md-pdf2json API'
})

router.post('/process', upload.fields([
    { name: 'request', maxCount: 1 },
    { name: 'content', maxCount: 1 }
  ]), async function (ctx) {

    let output = {response: {
        type: "stored",
        uri: []
    }}
    const requestFilepath = ctx.request.files['request'][0].path
    const contentFilepath = ctx.request.files['content'][0].path

    try {
        var dirname = uuidv4()
        var requestJSON = await fse.readJSON(requestFilepath, 'utf-8')
        if(typeof requestJSON === 'string')
            requestJSON = JSON.parse(requestJSON)
        const task = requestJSON.params.task
        delete requestJSON.params.task

        if(task == 'pdf2json') {
            output.response.uri = await processPDF(dirname, contentFilepath, requestFilepath);
            console.log("Response:", output)
        }

    } catch (e) {
        console.log(e)
        console.log(e.message)
        try {
            await fse.unlink(requestFilepath)
            await fse.unlink(contentFilepath)
        } catch(e) {
            console.log('Removing of temp files failed')
        }

    }
	ctx.body = output
})

router.get('/files/:dir/:file', async function (ctx) {
    var input_path = path.join('data', ctx.request.params.dir, ctx.request.params.file)
    const src = fs.createReadStream(input_path);
    ctx.set('Content-Disposition', `attachment; filename=${ctx.request.params.file}`);
    ctx.type = 'application/octet-stream';
    ctx.body = src
})



const processPDF = async (dirname, contentFilepath, requestFilepath) => {
    try {
        // Ensure directory exists
        await fse.ensureDir(`data/${dirname}`);

        // Wrap the PDF parsing and file writing in a promise
        const resultPath = await new Promise((resolve, reject) => {
            pdfParser.on("pdfParser_dataError", (errData) => {
                console.error("PDF parsing error:", errData.parserError);
                reject(new Error("PDF parsing failed"));
            });

            pdfParser.on("pdfParser_dataReady", async (pdfData) => {
                const outputPath = `data/${dirname}/result.json`;
                try {
                    await fse.writeFile(outputPath, JSON.stringify(pdfData));
                    //await chunkJSON(pdfData);
                    var text = parseTextPerPage(pdfData);
                    console.log(text)
                    console.log("File written successfully.");
                    resolve(outputPath);
                } catch (err) {
                    console.error("Error writing file:", err);
                    reject(err);
                }
            });

            pdfParser.loadPDF(contentFilepath);
        });

        console.log("PDF processed successfully:", resultPath);
        await fse.unlink(requestFilepath);
        await fse.unlink(contentFilepath);

        return  `/files/${dirname}/result.json`

    } catch (err) {
        console.error("Error processing PDF:", err);
        throw err;
    }
};

function parseTextPerPage(jsonData) {
    const result = [];
  
    // Check if the JSON data has Pages
    if (!jsonData.Pages || !Array.isArray(jsonData.Pages)) {
      throw new Error("Invalid JSON format: Missing or incorrect 'Pages' field.");
    }
 

    // Iterate over each page
    jsonData.Pages.forEach((page, pageIndex) => {
      const lineHeights = [];
      const pageTexts = [];
 
        // get average line height
        var prevY = 0
        if (Array.isArray(page.Texts)) {
            page.Texts.forEach(textObj => {
                if (textObj.y) {
                    lineHeights.push(textObj.y -prevY);
                    prevY = textObj.y
                }
            });
        }

        var baseLine = largestRoundedGroup(lineHeights);
        console.log("baseLine", baseLine)

        prevY = 0
      // Check if the page has Texts and iterate over them
      if (Array.isArray(page.Texts)) {
        page.Texts.forEach(textObj => {
            var currentBase = 0
            if (textObj.y) {
                var currentBase = Math.round((textObj.y -prevY) *10) / 10; // Round to nearest 0.1
                prevY = textObj.y
                console.log(currentBase, baseLine.value)
            }
          // Iterate over the text runs in the 'R' field
          if (Array.isArray(textObj.R)) {
            textObj.R.forEach(run => {
              // Decode URL-encoded text and add it to the pageTexts array
              if (run.T) {
                if(currentBase > baseLine.value) {
                    pageTexts.push("\n")
                }
                pageTexts.push(decodeURIComponent(run.T));
              }
            });
          }
        });
      }
  
      if(pageTexts.length == 0) {   
        result.push("[no_text_found]");
      } else {
        result.push(pageTexts.join(" "))
      }
    });
  
    return result;
  }


  function largestRoundedGroup(numbers) {
    if (!Array.isArray(numbers) || numbers.length === 0) {
      throw new Error("Input must be a non-empty array of numbers.");
    }
  
    const groups = {};
  
    // Group numbers by rounding to the nearest 0.1
    numbers.forEach(num => {
      const rounded = Math.round(num * 10) / 10; // Round to nearest 0.1
      groups[rounded] = (groups[rounded] || 0) + 1; // Count occurrences
    });
  
    // Find the largest group
    let largestGroupKey = null;
    let largestGroupSize = 0;
  
    Object.keys(groups).forEach(key => {
      const groupSize = groups[key];
      if (groupSize > largestGroupSize) {
        largestGroupSize = groupSize;
        largestGroupKey = key;
      }
    });
  
    // Convert the group key back to a float and return the group info
    return {
      value: parseFloat(largestGroupKey),
      size: largestGroupSize,
    };
  }
  
//   // Example Usage
//   const numbers = [1.21, 1.24, 1.25, 2.35, 2.36, 2.31, 2.4];
//   const largestGroup = largestRoundedGroup(numbers);
//   console.log(largestGroup);
//   // Output: { roundedValue: 2.4, size: 3 }
  


function calculateNormalLineHeight(lineHeights) {
    console.log(lineHeights)
    if (lineHeights.length === 0) return 0;
    const sortedHeights = [...lineHeights].sort((a, b) => a - b);
    return sortedHeights[Math.floor(sortedHeights.length / 2)]; // Median line hei
}

async function chunkJSON(json) {
    var pageNro = 1
    for(var page in json.Pages) {
        //console.log(json.Pages[page].Texts)
        console.log(`PAGE: ${pageNro} **********`)
        for(var text in json.Pages[page].Texts) {
            console.log(json.Pages[page].Texts[text].R)
        }
        pageNro++
    }
}

app.use(router.routes());


var set_port = process.env.PORT || 9000
var server = app.listen(set_port, function () {
   var host = server.address().address
   var port = server.address().port

   console.log('md-pdf2json running at http://%s:%s', host, port)
})

