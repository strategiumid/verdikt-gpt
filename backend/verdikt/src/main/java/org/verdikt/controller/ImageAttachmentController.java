package org.verdikt.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.verdikt.dto.ImageUploadResponse;
import org.verdikt.entity.User;
import org.verdikt.service.ImageAttachmentService;

@RestController
@RequestMapping("/api/images")
public class ImageAttachmentController {

    private final ImageAttachmentService imageAttachmentService;

    public ImageAttachmentController(ImageAttachmentService imageAttachmentService) {
        this.imageAttachmentService = imageAttachmentService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImageUploadResponse> upload(
            @AuthenticationPrincipal User user,
            @RequestParam("image") MultipartFile image
    ) {
        ImageUploadResponse response = imageAttachmentService.upload(user, image);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
