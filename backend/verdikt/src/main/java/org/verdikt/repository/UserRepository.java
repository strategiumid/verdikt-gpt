package org.verdikt.repository;

import org.verdikt.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Репозиторий для работы с пользователями в БД.
 * Spring Data JPA сам реализует методы save(), findById(), findAll() и т.д.
 */
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * Поиск пользователя по email (для регистрации и логина).
     * Spring сгенерирует запрос: SELECT * FROM users WHERE email = ?
     */
    Optional<User> findByEmail(String email);
}
