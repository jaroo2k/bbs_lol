FROM rockylinux:9

ARG PHP_VERSION=8.5.12
ENV PHP_INI_DIR=/usr/local/etc/php

RUN dnf -y install dnf-plugins-core epel-release \
    && dnf config-manager --set-enabled crb \
    && dnf -y install \
        gcc gcc-c++ make autoconf bison re2c pkgconf-pkg-config xz tar git unzip \
        curl-minimal ca-certificates diffutils zlib-devel \
        libxml2-devel openssl-devel sqlite-devel libcurl-devel oniguruma-devel \
        libzip-devel libpng-devel libjpeg-turbo-devel libwebp-devel freetype-devel \
        libicu-devel readline-devel libsodium-devel \
    && dnf clean all

RUN curl -fsSL "https://www.php.net/distributions/php-${PHP_VERSION}.tar.xz" -o /tmp/php.tar.xz \
    && mkdir -p /usr/src/php && tar -xJf /tmp/php.tar.xz -C /usr/src/php --strip-components=1 \
    && cd /usr/src/php \
    && ./configure \
        --prefix=/usr/local \
        --with-config-file-path="${PHP_INI_DIR}" \
        --with-config-file-scan-dir="${PHP_INI_DIR}/conf.d" \
        --enable-fpm --with-fpm-user=apache --with-fpm-group=apache \
        --enable-mbstring --enable-intl --enable-bcmath --enable-pcntl --enable-opcache \
        --enable-gd --with-jpeg --with-webp --with-freetype \
        --with-mysqli=mysqlnd --with-pdo-mysql=mysqlnd \
        --with-openssl --with-curl --with-zlib --with-zip --with-readline --with-sodium \
    && make -j"$(nproc)" && make install \
    && rm -rf /usr/src/php /tmp/php.tar.xz

RUN mkdir -p "${PHP_INI_DIR}/conf.d" /var/www/html \
    && useradd -r -s /sbin/nologin apache

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

COPY php.ini "${PHP_INI_DIR}/php.ini"
COPY www.conf /usr/local/etc/php-fpm.d/www.conf
RUN printf '[global]\nerror_log = /proc/self/fd/2\ninclude=/usr/local/etc/php-fpm.d/*.conf\n' > /usr/local/etc/php-fpm.conf

WORKDIR /var/www/html
EXPOSE 9000
CMD ["php-fpm", "-F"]
