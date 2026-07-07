package com.agenthub.dto;

import lombok.Data;

@Data
public class AiChatRequest {
    private String message;
    private Double x;
    private Double y;
}