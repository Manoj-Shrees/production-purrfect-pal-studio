# OS-Level Firewall Auto-Blocking (Fail2ban Guide)

This guide explains how to configure **Fail2ban** on your Linux host VPS to automatically ban IP addresses at the kernel firewall level (`iptables`) when they spam requests and exceed Nginx's rate limits.

---

## 🛠️ Step 1: Ensure Nginx logs are accessible on the VPS host

For Fail2ban to scan the Nginx error logs, the logs must be mounted to a directory on your VPS host system.

1. Locate your Nginx service in `docker-compose.yml`.
2. Under `volumes`, map the container logs to a host folder. Example:
   ```yaml
   services:
     nginx:
       image: nginx:alpine
       # ... other configuration ...
       volumes:
         - /var/log/nginx:/var/log/nginx
   ```
3. Restart Nginx using Docker Compose:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

---

## 📥 Step 2: Install Fail2ban on the Host VPS

Install Fail2ban directly on the VPS host machine (e.g. Ubuntu/Debian):

```bash
sudo apt update
sudo apt install fail2ban -y
```

---

## ⚙️ Step 3: Copy Configuration Files

Copy the configuration files from this project directory to the VPS Fail2ban configuration directories:

1. **Copy the Filter**:
   Place [nginx-limit-req.conf](file:///Users/suwas/Desktop/production-purrfect-pal-studio/fail2ban/filter.d/nginx-limit-req.conf) into `/etc/fail2ban/filter.d/`:
   ```bash
   sudo cp ./fail2ban/filter.d/nginx-limit-req.conf /etc/fail2ban/filter.d/
   ```

2. **Copy the Jail**:
   Place [nginx-jails.conf](file:///Users/suwas/Desktop/production-purrfect-pal-studio/fail2ban/jail.d/nginx-jails.conf) into `/etc/fail2ban/jail.d/`:
   ```bash
   sudo cp ./fail2ban/jail.d/nginx-jails.conf /etc/fail2ban/jail.d/
   ```

---

## 🚀 Step 4: Restart & Enable Fail2ban

Start the Fail2ban service and set it to automatically run on system boot:

```bash
sudo systemctl restart fail2ban
sudo systemctl enable fail2ban
```

---

## 🔍 Step 5: Verification & Monitoring

1. Check the status of the Fail2ban jail:
   ```bash
   sudo fail2ban-client status nginx-limit-req
   ```
   *Expected output:* Shows the jail is active, the number of currently banned IPs, and total failures.

2. View currently active iptables rules:
   ```bash
   sudo iptables -L -n -v
   ```
   You will see an active chain named `f2b-nginx-limit-req` managing traffic.

3. To manually unban an IP address:
   ```bash
   sudo fail2ban-client set nginx-limit-req unbanip <IP_ADDRESS>
   ```
