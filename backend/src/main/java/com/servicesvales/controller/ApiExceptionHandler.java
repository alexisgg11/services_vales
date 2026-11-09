package com.servicesvales.controller;

import com.servicesvales.model.OperacionException;
import java.sql.SQLException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    private static final Logger LOG = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(OperacionException.class)
    public ProblemDetail operacion(OperacionException error) {
        HttpStatus status = switch (error.tipo()) {
            case SIN_PERMISO -> HttpStatus.FORBIDDEN;
            case NO_ENCONTRADO -> HttpStatus.NOT_FOUND;
            case INVALIDA -> HttpStatus.UNPROCESSABLE_CONTENT;
        };
        return ProblemDetail.forStatusAndDetail(status, error.getMessage());
    }

    @ExceptionHandler(DataAccessException.class)
    public ProblemDetail postgres(DataAccessException error) {
        if (error.getMostSpecificCause() instanceof SQLException sql && sql.getSQLState() != null) {
            return switch (sql.getSQLState()) {
                case "42501" -> ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN,
                        "La cuenta no tiene permiso para esta operación.");
                case "23505" -> ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                        "Ya existe un registro con esos datos.");
                case "23503", "23514", "23502" -> ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_CONTENT,
                        "Revisa los datos y las referencias de la operación.");
                case "22023", "P0001" -> ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_CONTENT,
                        sql.getMessage().lines().findFirst().orElse("").replaceFirst("^ERROR: ", ""));
                default -> falloPostgres(sql.getSQLState());
            };
        }
        return falloPostgres("sin código");
    }

    private ProblemDetail falloPostgres(String estado) {
        LOG.warn("Falló una operación de PostgreSQL (SQLSTATE {}).", estado);
        return ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR,
                "No se pudo completar la operación. Vuelve a intentarlo.");
    }
}
