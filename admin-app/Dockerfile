FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

# Copy static site into the admin-app subdirectory to match nginx root
COPY index.html /usr/share/nginx/html/admin-app/
COPY css/       /usr/share/nginx/html/admin-app/css/
COPY js/        /usr/share/nginx/html/admin-app/js/
COPY assets/    /usr/share/nginx/html/admin-app/assets/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]