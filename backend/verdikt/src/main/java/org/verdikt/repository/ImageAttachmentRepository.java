package org.verdikt.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.verdikt.entity.ImageAttachment;

import java.util.Optional;

public interface ImageAttachmentRepository extends JpaRepository<ImageAttachment, String> {
    Optional<ImageAttachment> findByIdAndUser_Id(String id, Long userId);
}
