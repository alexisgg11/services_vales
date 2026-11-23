package com.servicesvales;

import com.servicesvales.config.ArranqueVales;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ServicesValesApplication {

  public static void main(String[] args) throws Exception {
    ArranqueVales.iniciar(ServicesValesApplication.class, args);
  }
}
