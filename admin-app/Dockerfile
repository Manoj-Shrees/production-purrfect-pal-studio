FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

# Copy directly to root — matches the relative paths in index.html
COPY index.html /usr/share/nginx/html/
COPY css/       /usr/share/nginx/html/css/
COPY js/        /usr/share/nginx/html/js/
COPY assets/    /usr/share/nginx/html/assets/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]