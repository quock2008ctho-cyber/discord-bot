const { Client, GatewayIntentBits, PermissionsBitField } = require("discord.js");
const fs = require("fs");

/* ================= CLIENT ================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* ================= CONFIG ================= */
const DATA_FILE = "./data.json";

/* ================= LOAD DATA ================= */
let data = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE))
  : {
      users: {},
      gang: { tienquy: 0, caosu: 0, kimloai: 0 },
      system: { lastResetWeek: null }
    };

let quy = data.users;
let gang = data.gang;
let system = data.system;

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/* ================= UTILS ================= */
function isAdmin(member) {
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.permissions.has(PermissionsBitField.Flags.ManageGuild)
  );
}

function initUser(id) {
  if (!quy[id]) {
    quy[id] = {
      tienquy: 0,
      caosu: 0,
      kimloai: 0,
      rank: { tienquy: 0, caosu: 0, kimloai: 0 }
    };
  }
}

function getWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

/* ================= READY + RESET BXH ================= */
client.once("ready", () => {
  console.log(`✅ Bot online: ${client.user.tag}`);

  setInterval(() => {
    const now = new Date();
    if (now.getDay() !== 0 || now.getHours() !== 0 || now.getMinutes() !== 0) return;

    const week = getWeekKey(now);
    if (system.lastResetWeek === week) return;

    sendTopRanking();

    for (const id in quy) {
      quy[id].rank = { tienquy: 0, caosu: 0, kimloai: 0 };
    }

    system.lastResetWeek = week;
    saveData();
    console.log("🔄 Đã reset BXH tuần");
  }, 60 * 1000);
});

/* ================= MESSAGE ================= */
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!isAdmin(message.member)) return;

  const args = message.content.trim().split(/\s+/);
  const cmd = args[0].toLowerCase();
  const user = message.mentions.users.first();
  const amount = parseInt(args[args.length - 1]);

  const map = {
    noptienquy: "tienquy",
    nopcaosu: "caosu",
    nopkimloai: "kimloai",
    ruttienquy: "tienquy",
    rutcaosu: "caosu",
    rutkimloai: "kimloai"
  };

  /* ===== NỘP / RÚT ===== */
  if (map[cmd]) {
    if (!user || isNaN(amount) || amount <= 0) {
      return message.reply(
        "❌ **Sai Cú Pháp Rồi Bạn Nhé !!**\n\n" +
        "👉 **Tiền quỹ:** `noptienquy @tên số_lượng`\n" +
        "👉 **Cao su:** `nopcaosu @tên số_lượng`\n" +
        "👉 **Kim loại:** `nopkimloai @tên số_lượng`"
      );
    }

    initUser(user.id);
    const type = map[cmd];
    const isRut = cmd.startsWith("rut");

    if (isRut && quy[user.id][type] < amount) {
      return message.reply("❌ Không đủ số lượng để rút!");
    }

    quy[user.id][type] += isRut ? -amount : amount;
    gang[type] += isRut ? -amount : amount;

    if (!isRut) quy[user.id].rank[type] += amount;

    saveData();

    const icon = type === "tienquy" ? "💰" : type === "caosu" ? "🛢️" : "🔩";

    message.channel.send(
      `${user}\n` +
      `🎉 **ĐÃ ${isRut ? "RÚT" : "ĐÓNG GÓP"} ${amount} ${icon} VÀO KHO GANG**\n` +
      `😄 **Đóng góp này đã giúp bạn tăng điểm BXH!**`
    );
  }

  /* ===== THỐNG KÊ CÁ NHÂN ===== */
  if (cmd === "thongke" && user) {
    initUser(user.id);
    const d = quy[user.id];

    message.channel.send({
      embeds: [{
        color: 0x3498db,
        title: `📊 THỐNG KÊ ${user.username}`,
        fields: [
          { name: "💰 Tiền quỹ", value: `${d.tienquy}`, inline: true },
          { name: "🛢️ Cao su", value: `${d.caosu}`, inline: true },
          { name: "🔩 Kim loại", value: `${d.kimloai}`, inline: true }
        ]
      }]
    });
  }

  /* ===== THỐNG KÊ GANG ===== */
  if (cmd === "thongke" && args[1] === "yakuza") {
    const embed = {
      color: 0x8b0000,
      title: "🏛️ THỐNG KÊ GANG YAKUZA",
      description:
        `🏦 **TỔNG KHO GANG**\n` +
        `💰 ${gang.tienquy}\n🛢️ ${gang.caosu}\n🔩 ${gang.kimloai}`,
      fields: []
    };

    for (const id in quy) {
      const u = await client.users.fetch(id);
      const d = quy[id];
      embed.fields.push({
        name: `👤 ${u.username}`,
        value: `💰 ${d.tienquy} | 🛢️ ${d.caosu} | 🔩 ${d.kimloai}`,
        inline: false
      });
    }

    message.channel.send({ embeds: [embed] });
  }

  /* ===== BXH ===== */
  if (cmd === "xephang" && args[1] === "thongke") {
    sendRanking(message.channel);
  }
});

/* ================= BXH ================= */
function sendRanking(channel) {
  const types = ["tienquy", "caosu", "kimloai"];
  const embed = {
    color: 0xffd700,
    title: "🏆 BẢNG XẾP HẠNG TUẦN",
    fields: []
  };

  for (const type of types) {
    const icon = type === "tienquy" ? "💰" : type === "caosu" ? "🛢️" : "🔩";
    const sorted = Object.entries(quy)
      .sort((a, b) => b[1].rank[type] - a[1].rank[type])
      .slice(0, 10);

    let value = sorted.length
      ? sorted.map(([id, d], i) => {
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "▫️";
          return `${medal} <@${id}> — **${d.rank[type]}**`;
        }).join("\n")
      : "Chưa có dữ liệu";

    embed.fields.push({
      name: `${icon} ${type.toUpperCase()}`,
      value,
      inline: false
    });
  }

  channel.send({ embeds: [embed] });
}

/* ================= TOP RESET ================= */
function sendTopRanking() {
  console.log("📢 TOP 1–2–3 tuần đã được tổng kết (chuẩn bị reset)");
}

/* ================= LOGIN ================= */
client.login(process.env.TOKEN);

