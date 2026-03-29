const fs = require('fs');
const path = require('path');
const PDFLib = require('pdf-lib');
const sharp = require('sharp');

// 输入图片目录和输出 PDF 文件路径
const inputDir = './';
const outputPdf = 'output.pdf';

// 支持的图片格式
const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

function getSortedImages(dir) {
  const files = fs.readdirSync(dir);
  const imageFiles = files
    .filter(file => {
      const ext = path.extname(file).toLowerCase();
      return supportedExtensions.includes(ext);
    })
    .map(file => ({
      name: file,
      path: path.join(dir, file),
      number: parseInt(file.match(/(\d+)/)?.[1], 10) || 0,
    }))
    .sort((a, b) => a.number - b.number);

  return imageFiles;
}

// 根据文件扩展名选择正确的嵌入方法
async function embedImage(pdfDoc, imageBuffer, extension) {
  const ext = extension.toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') {
    return await pdfDoc.embedJpg(imageBuffer);
  } else if (ext === '.png') {
    return await pdfDoc.embedPng(imageBuffer);
  } else if (ext === '.webp') {
    // WebP 需要先转为 PNG/JPG。这里我们直接转为 JPEG 以便嵌入。
    const jpegBuffer = await sharp(imageBuffer).jpeg().toBuffer();
    return await pdfDoc.embedJpg(jpegBuffer);
  }
  throw new Error(`不支持的图片格式: ${extension}`);
}

async function convertImagesToPDF() {
  const images = getSortedImages(inputDir);

  if (images.length === 0) {
    console.error('没有找到支持的图片文件！');
    return;
  }

  console.log(`正在处理 ${images.length} 张图片...`);

  const pdfDoc = await PDFLib.PDFDocument.create();

  for (const img of images) {
    try {
      const buffer = await sharp(img.path).toBuffer();
      const imgDims = await sharp(buffer).metadata();
      const imgWidth = imgDims.width;
      const imgHeight = imgDims.height;

      const page = pdfDoc.addPage([imgWidth, imgHeight]);

      // 使用正确的嵌入函数
      const embeddedImg = await embedImage(pdfDoc, buffer, path.extname(img.path));

      page.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: imgWidth,
        height: imgHeight,
      });

      console.log(`已添加: ${img.name} (${imgWidth}x${imgHeight})`);
    } catch (error) {
      console.error(`处理图片失败: ${img.name}`, error.message);
    }
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPdf, pdfBytes);
  console.log(`✅ PDF 已生成: ${outputPdf}`);
}

convertImagesToPDF().catch(console.error);
