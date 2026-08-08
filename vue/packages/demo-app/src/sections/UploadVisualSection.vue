<template>
  <div
    id="upload-visual"
    class="demo-section"
    data-testid="upload-visual-fixtures"
  >
    <h2>Upload Visual Acceptance</h2>

    <!-- Dragger variants -->
    <div class="demo-block" data-upload-fixture="dragger">
      <h3>Dragger</h3>
      <div class="upload-fixture-row" data-upload-variant="dragger-default">
        <el-upload drag action="#" :auto-upload="false">
          <div class="el-upload__text">
            Drop file here or <em>click to upload</em>
          </div>
          <p data-upload-help>PNG or JPEG, up to 2 MB. 16:9 crop.</p>
        </el-upload>
      </div>
      <div class="upload-fixture-row" data-upload-variant="dragger-disabled">
        <el-upload drag action="#" :auto-upload="false" disabled>
          <div class="el-upload__text">
            Drop file here or <em>click to upload</em>
          </div>
          <p data-upload-help>Uploads are currently disabled.</p>
        </el-upload>
      </div>
      <div class="upload-fixture-row" data-upload-variant="dragger-cjk">
        <el-upload drag action="#" :auto-upload="false">
          <div class="el-upload__text">
            将文件拖到此处，或<em>点击上传</em>
          </div>
          <p data-upload-help>支持 PNG 或 JPEG，最大 2 MB，裁切比例为 16:9。</p>
        </el-upload>
      </div>
      <div class="upload-fixture-row" data-upload-variant="dragger-rtl" dir="rtl">
        <el-upload drag action="#" :auto-upload="false">
          <div class="el-upload__text">
            גרור קובץ לכאן או <em>לחץ להעלאה</em>
          </div>
          <p data-upload-help>PNG או JPEG, עד 2 MB.</p>
        </el-upload>
      </div>
    </div>

    <!-- Text list with pre-populated files -->
    <div class="demo-block" data-upload-fixture="text-list">
      <h3>Text File List</h3>
      <div class="upload-fixture-row" data-upload-variant="text-ready">
        <el-upload
          action="#"
          :auto-upload="false"
          :file-list="textReadyFiles"
        />
      </div>
      <div class="upload-fixture-row" data-upload-variant="text-uploading">
        <el-upload
          action="#"
          :auto-upload="false"
          :file-list="textUploadingFiles"
        />
      </div>
      <div class="upload-fixture-row" data-upload-variant="text-success">
        <el-upload
          action="#"
          :auto-upload="false"
          :file-list="textSuccessFiles"
        />
      </div>
      <div class="upload-fixture-row" data-upload-variant="text-fail">
        <el-upload
          action="#"
          :auto-upload="false"
          :file-list="textFailFiles"
        />
      </div>
      <div class="upload-fixture-row" data-upload-variant="text-long-filename">
        <el-upload
          action="#"
          :auto-upload="false"
          :file-list="textLongFilenameFiles"
        />
      </div>
      <div class="upload-fixture-row" data-upload-variant="text-mixed">
        <el-upload
          action="#"
          :auto-upload="false"
          :file-list="textMixedFiles"
        />
      </div>
      <div class="upload-fixture-row" data-upload-variant="text-disabled">
        <el-upload
          action="#"
          :auto-upload="false"
          :file-list="textDisabledFiles"
          disabled
        />
      </div>
    </div>

    <!-- Picture list -->
    <div class="demo-block" data-upload-fixture="picture-list">
      <h3>Picture List</h3>
      <div class="upload-fixture-row" data-upload-variant="picture-default">
        <el-upload
          action="#"
          list-type="picture"
          :auto-upload="false"
          :file-list="pictureFiles"
        />
      </div>
      <div class="upload-fixture-row" data-upload-variant="picture-multi">
        <el-upload
          action="#"
          list-type="picture"
          :auto-upload="false"
          :file-list="pictureMultiFiles"
        />
      </div>
    </div>

    <!-- Picture-card list -->
    <div class="demo-block" data-upload-fixture="picture-card-list">
      <h3>Picture Card List</h3>
      <div class="upload-fixture-row" data-upload-variant="picture-card-default">
        <el-upload
          action="#"
          list-type="picture-card"
          :auto-upload="false"
          :file-list="pictureCardFiles"
        />
      </div>
      <div class="upload-fixture-row" data-upload-variant="picture-card-disabled">
        <el-upload
          action="#"
          list-type="picture-card"
          :auto-upload="false"
          :file-list="pictureCardDisabledFiles"
          disabled
        />
      </div>
    </div>

    <!-- Static CSS gate: ensure no legacy patterns exist -->
    <div
      data-testid="upload-gate-css"
      style="display: none"
      aria-hidden="true"
    />
  </div>
</template>

<script setup lang="ts">
import type { UploadUserFile } from '@element-plus/components/upload'

const textReadyFiles: UploadUserFile[] = [
  { name: 'release-notes-v2.3.0.md', status: 'ready', uid: 1001 },
  { name: 'screenshot-final.png', status: 'ready', uid: 1002 },
]

const textUploadingFiles: UploadUserFile[] = [
  { name: 'large-dataset.csv', status: 'uploading', uid: 2001, percentage: 67 },
  { name: 'report-draft.pdf', status: 'uploading', uid: 2002, percentage: 42 },
]

const textSuccessFiles: UploadUserFile[] = [
  { name: 'cover-image-final.png', status: 'success', uid: 3001 },
  { name: 'site-audit-report.pdf', status: 'success', uid: 3002 },
  { name: 'team-photo-2026.jpg', status: 'success', uid: 3003 },
]

const textFailFiles: UploadUserFile[] = [
  { name: 'oversized-photo.psd', status: 'fail', uid: 4001 },
  { name: 'corrupted-archive.zip', status: 'fail', uid: 4002 },
]

const textLongFilenameFiles: UploadUserFile[] = [
  {
    name: 'Q4-2026-quarterly-business-review-and-strategic-planning-committee-final-approved-version-v7-revised.pdf',
    status: 'success',
    uid: 5001,
  },
  {
    name: '2026年度第四季度經營檢討與策略規劃委員會最終核定版修訂七版-已簽核.pdf',
    status: 'success',
    uid: 5002,
  },
]

const textMixedFiles: UploadUserFile[] = [
  { name: 'pending-review.docx', status: 'ready', uid: 6001 },
  { name: 'uploading-now.mp4', status: 'uploading', uid: 6002, percentage: 31 },
  { name: 'done.png', status: 'success', uid: 6003 },
  { name: 'failed.bin', status: 'fail', uid: 6004 },
]

const textDisabledFiles: UploadUserFile[] = [
  { name: 'locked-file.txt', status: 'success', uid: 7001 },
  { name: 'read-only.md', status: 'ready', uid: 7002 },
]

const pictureFiles: UploadUserFile[] = [
  {
    name: 'banner-hero.png',
    status: 'success',
    uid: 8001,
    url: 'https://fuss10.elemecdn.com/3/28/bb3e3c3e0b3e3c3e0b3e3c3e0b3e3c3e.png',
  },
]

const pictureMultiFiles: UploadUserFile[] = [
  {
    name: 'product-shot-1.jpg',
    status: 'success',
    uid: 8002,
    url: 'https://fuss10.elemecdn.com/3/28/bb3e3c3e0b3e3c3e0b3e3c3e0b3e3c3e.png',
  },
  {
    name: 'product-shot-2.jpg',
    status: 'uploading',
    uid: 8003,
    percentage: 55,
    url: 'https://fuss10.elemecdn.com/3/28/bb3e3c3e0b3e3c3e0b3e3c3e0b3e3c3e.png',
  },
  {
    name: 'product-shot-3.jpg',
    status: 'fail',
    uid: 8004,
    url: 'https://fuss10.elemecdn.com/3/28/bb3e3c3e0b3e3c3e0b3e3c3e0b3e3c3e.png',
  },
]

const pictureCardFiles: UploadUserFile[] = [
  {
    name: 'screenshot-1.png',
    status: 'success',
    uid: 9001,
    url: 'https://fuss10.elemecdn.com/3/28/bb3e3c3e0b3e3c3e0b3e3c3e0b3e3c3e.png',
  },
  {
    name: 'screenshot-2.png',
    status: 'success',
    uid: 9002,
    url: 'https://fuss10.elemecdn.com/e/5e/0b3e3c3e0b3e3c3e0b3e3c3e0b3e3c3e.png',
  },
  {
    name: 'screenshot-3.png',
    status: 'uploading',
    uid: 9003,
    percentage: 78,
    url: 'https://fuss10.elemecdn.com/3/28/bb3e3c3e0b3e3c3e0b3e3c3e0b3e3c3e.png',
  },
  {
    name: 'broken-thumbnail.jpg',
    status: 'fail',
    uid: 9004,
    url: 'https://example.com/missing-image-404.jpg',
  },
]

const pictureCardDisabledFiles: UploadUserFile[] = [
  {
    name: 'locked-pic-1.png',
    status: 'success',
    uid: 9005,
    url: 'https://fuss10.elemecdn.com/3/28/bb3e3c3e0b3e3c3e0b3e3c3e0b3e3c3e.png',
  },
  {
    name: 'locked-pic-2.png',
    status: 'success',
    uid: 9006,
    url: 'https://fuss10.elemecdn.com/e/5e/0b3e3c3e0b3e3c3e0b3e3c3e0b3e3c3e.png',
  },
]
</script>
