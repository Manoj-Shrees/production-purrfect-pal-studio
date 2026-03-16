FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy static site files
COPY index.html /usr/share/nginx/html/
COPY css/       /usr/share/nginx/html/css/
COPY js/        /usr/share/nginx/html/js/
COPY assets/    /usr/share/nginx/html/assets/

# If you have the macOS .dmg in the repo, include it too:
# COPY macos/ /usr/share/nginx/html/macos/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
