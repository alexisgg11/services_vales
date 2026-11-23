package com.servicesvales.config;

import com.servicesvales.modulos.identidad.aplicacion.UsuarioService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.savedrequest.HttpSessionRequestCache;

@Configuration
public class SeguridadConfig {

  @Bean
  SecurityFilterChain seguridad(HttpSecurity http) throws Exception {
    HttpSessionRequestCache cache = new HttpSessionRequestCache();
    cache.setRequestMatcher(request -> {
      String path = request.getRequestURI();
      return (
        "GET".equals(request.getMethod()) &&
        ("/".equals(path) ||
          "/consulta".equals(path) ||
          path.startsWith("/vales/q/"))
      );
    });
    return http
      .authorizeHttpRequests(requests ->
        requests
          .requestMatchers(
            HttpMethod.GET,
            "/vales/q/*",
            "/vales/q/*/verificacion",
            "/api/publico/vales/*"
          )
          .permitAll()
          .requestMatchers("/app/**", "/api/csrf", "/favicon.ico")
          .permitAll()
          .anyRequest()
          .authenticated()
      )
      .requestCache(requests -> requests.requestCache(cache))
      .exceptionHandling(errors ->
        errors.defaultAuthenticationEntryPointFor(
          (request, response, error) -> response.sendError(401),
          request -> request.getRequestURI().startsWith("/api/")
        )
      )
      .formLogin(login ->
        login
          .loginPage("/app/login")
          .loginProcessingUrl("/login")
          .defaultSuccessUrl("/app/index.html")
          .failureUrl("/app/login?error")
          .permitAll()
      )
      .logout(logout -> logout.logoutSuccessUrl("/app/login"))
      .build();
  }

  @Bean
  UserDetailsService cuentas(UsuarioService usuarios) {
    return login ->
      usuarios
        .buscarActiva(login)
        .map(cuenta ->
          User.withUsername(cuenta.login())
            .password(cuenta.claveHash())
            .roles("USUARIO")
            .build()
        )
        .orElseThrow(() ->
          new UsernameNotFoundException("Cuenta no disponible")
        );
  }

  @Bean
  PasswordEncoder passwordEncoder() {
    return PasswordEncoderFactories.createDelegatingPasswordEncoder();
  }
}
