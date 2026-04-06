package org.verdikt.dto;

public class ImageUploadResponse {

    private String imageId;
    private String fileName;
    private String contentType;
    private long sizeBytes;

    public ImageUploadResponse() {
    }

    public ImageUploadResponse(String imageId, String fileName, String contentType, long sizeBytes) {
        this.imageId = imageId;
        this.fileName = fileName;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
    }

    public String getImageId() {
        return imageId;
    }

    public void setImageId(String imageId) {
        this.imageId = imageId;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public long getSizeBytes() {
        return sizeBytes;
    }

    public void setSizeBytes(long sizeBytes) {
        this.sizeBytes = sizeBytes;
    }
}
