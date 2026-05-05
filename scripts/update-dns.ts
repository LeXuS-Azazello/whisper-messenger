import "dotenv/config";

async function updateDNS(ip: string) {
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;
    const token = process.env.CLOUDFLARE_GLOBAL_TOKEN;
    const email = process.env.CLOUDFLARE_EMAIL;
    const domain = "voicemsg.net";

    if (!zoneId || !token) {
        console.error("Missing CLOUDFLARE_ZONE_ID or CLOUDFLARE_GLOBAL_TOKEN");
        return;
    }

    const headers: any = {
        "Content-Type": "application/json"
    };

    if (email) {
        headers["X-Auth-Email"] = email;
        headers["X-Auth-Key"] = token;
    } else {
        headers["Authorization"] = `Bearer ${token}`;
    }

    console.log(`Updating DNS for ${domain} to ${ip} using ${email ? "Global API Key" : "API Token"}...`);

    try {
        // 1. Find the A record ID
        const listRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A&name=${domain}`, {
            headers
        });
        
        const listData: any = await listRes.json();
        if (!listData.success) throw new Error(JSON.stringify(listData.errors));

        const record = listData.result[0];
        if (!record) {
            console.log("Record not found, creating new one...");
            const createRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    type: "A",
                    name: domain,
                    content: ip,
                    ttl: 1,
                    proxied: true
                })
            });
            const createData: any = await createRes.json();
            if (!createData.success) throw new Error(JSON.stringify(createData.errors));
            console.log("DNS record created successfully!");
        } else {
            console.log(`Found record ${record.id}, updating...`);
            const updateRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${record.id}`, {
                method: "PUT",
                headers,
                body: JSON.stringify({
                    type: "A",
                    name: domain,
                    content: ip,
                    ttl: 1,
                    proxied: true
                })
            });
            const updateData: any = await updateRes.json();
            if (!updateData.success) throw new Error(JSON.stringify(updateData.errors));
            console.log("DNS record updated successfully!");
        }
    } catch (e: any) {
        console.error("DNS update failed:", e.message);
    }
}

const targetIp = process.argv[2];
if (!targetIp) {
    console.error("Usage: tsx scripts/update-dns.ts <IP>");
    process.exit(1);
}

updateDNS(targetIp);
