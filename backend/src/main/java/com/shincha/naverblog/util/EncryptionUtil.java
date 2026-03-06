package com.shincha.naverblog.util;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Component
public class EncryptionUtil {

    @Value("${jasypt.encryptor.password:dev-secret-key-change-in-prod}")
    private String secretKey;

    private static final String ALGORITHM = "AES";

    public String encrypt(String plainText) {
        try {
            SecretKeySpec keySpec = new SecretKeySpec(
                    getPaddedKey(secretKey).getBytes(StandardCharsets.UTF_8), ALGORITHM
            );
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec);
            byte[] encrypted = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(encrypted);
        } catch (Exception e) {
            throw new RuntimeException("암호화 실패", e);
        }
    }

    public String decrypt(String encryptedText) {
        try {
            SecretKeySpec keySpec = new SecretKeySpec(
                    getPaddedKey(secretKey).getBytes(StandardCharsets.UTF_8), ALGORITHM
            );
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, keySpec);
            byte[] decoded = Base64.getDecoder().decode(encryptedText);
            byte[] decrypted = cipher.doFinal(decoded);
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("복호화 실패", e);
        }
    }

    // AES는 키가 16, 24, 32 바이트여야 함 → 항상 32바이트로 맞춤
    private String getPaddedKey(String key) {
        if (key.length() >= 32) return key.substring(0, 32);
        StringBuilder sb = new StringBuilder(key);
        while (sb.length() < 32) sb.append("0");
        return sb.toString();
    }
}
