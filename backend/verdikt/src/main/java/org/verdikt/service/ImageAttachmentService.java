package org.verdikt.service;

import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.verdikt.dto.ImageUploadResponse;
import org.verdikt.entity.ImageAttachment;
import org.verdikt.entity.User;
import org.verdikt.repository.ImageAttachmentRepository;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Base64;
import java.util.UUID;

@Service
public class ImageAttachmentService {

    private static final long MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

    private final ImageAttachmentRepository imageAttachmentRepository;
    private final Path uploadDir;

    public ImageAttachmentService(
            ImageAttachmentRepository imageAttachmentRepository,
            @Value("${app.images.upload-dir:./data/images}") String uploadDir
    ) {
        this.imageAttachmentRepository = imageAttachmentRepository;
        this.uploadDir = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    public ImageUploadResponse upload(User user, MultipartFile image) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Войдите в аккаунт");
        }
        if (image == null || image.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Изображение обязательно");
        }
        if (image.getSize() > MAX_IMAGE_SIZE_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Размер изображения не должен превышать 10MB");
        }

        String contentType = image.getContentType();
        if (contentType == null || !contentType.toLowerCase().startsWith("image/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Файл должен быть изображением");
        }

        String imageId = UUID.randomUUID().toString();
        String extension = extractExtension(image.getOriginalFilename());
        String storageFileName = extension.isBlank() ? imageId : imageId + "." + extension;

        try {
            Files.createDirectories(uploadDir);
            Path target = uploadDir.resolve(storageFileName).normalize();
            if (!target.startsWith(uploadDir)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Некорректное имя файла");
            }
            Files.copy(image.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Не удалось сохранить файл");
        }

        ImageAttachment attachment = new ImageAttachment();
        attachment.setId(imageId);
        attachment.setUser(user);
        attachment.setFileName(normalizeFileName(image.getOriginalFilename()));
        attachment.setContentType(contentType);
        attachment.setSizeBytes(image.getSize());
        attachment.setStorageFileName(storageFileName);

        attachment = imageAttachmentRepository.save(attachment);
        return new ImageUploadResponse(
                attachment.getId(),
                attachment.getFileName(),
                attachment.getContentType(),
                attachment.getSizeBytes()
        );
    }

    public String loadOwnedImageAsDataUrl(User user, String imageId) {
        if (user == null || imageId == null || imageId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Некорректный imageId");
        }
        ImageAttachment attachment = imageAttachmentRepository.findByIdAndUser_Id(imageId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Изображение не найдено"));
        Path path = uploadDir.resolve(attachment.getStorageFileName()).normalize();
        if (!path.startsWith(uploadDir) || !Files.exists(path)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Файл изображения не найден");
        }
        try {
            byte[] bytes = Files.readAllBytes(path);
            String base64 = Base64.getEncoder().encodeToString(bytes);
            return "data:" + attachment.getContentType() + ";base64," + base64;
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Не удалось прочитать файл изображения");
        }
    }

    private String normalizeFileName(String originalName) {
        if (originalName == null || originalName.isBlank()) {
            return "image";
        }
        String normalized = originalName.replace("\\", "/");
        int slashIndex = normalized.lastIndexOf('/');
        if (slashIndex >= 0 && slashIndex < normalized.length() - 1) {
            normalized = normalized.substring(slashIndex + 1);
        }
        return normalized.trim();
    }

    private String extractExtension(String originalName) {
        if (originalName == null || originalName.isBlank()) {
            return "";
        }
        String normalized = normalizeFileName(originalName);
        int dotIndex = normalized.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == normalized.length() - 1) {
            return "";
        }
        String ext = normalized.substring(dotIndex + 1).trim().toLowerCase();
        if (!ext.matches("[a-z0-9]{1,10}")) {
            return "";
        }
        return ext;
    }
}
