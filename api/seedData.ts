import * as repo from "./repositories.js";
import { v4 as uuidv4 } from "uuid";

export function seedSampleData() {
  const existingStores = repo.getStores();
  if (existingStores.length > 0) {
    console.log("样例数据已存在，跳过初始化");
    return false;
  }

  console.log("正在初始化样例数据...");

  const stores = [
    { id: uuidv4(), name: "门店A - 旗舰正常店", area: 150, category: "旗舰" },
    { id: uuidv4(), name: "门店B - 异常店", area: 120, category: "标准" },
    { id: uuidv4(), name: "门店C - 维修干扰店", area: 100, category: "社区" },
  ];
  for (const s of stores) repo.upsertStore({ name: s.name, area: s.area, category: s.category }, s.id);

  const globalThreshold = repo.saveThresholdConfig({
    storeId: null,
    dailyLimit: 150,
    fluctuationRate: 30,
    hoursCorrectionFactor: 1.0,
  });
  repo.saveThresholdConfig({
    storeId: stores[1].id,
    dailyLimit: 120,
    fluctuationRate: 25,
    hoursCorrectionFactor: 1.0,
  });

  const today = new Date("2026-06-15");
  const meterBatchId = uuidv4();
  const hoursBatchId = uuidv4();
  const maintenanceBatchId = uuidv4();

  const baseReadings: Record<string, number> = {
    [stores[0].id]: 1000,
    [stores[1].id]: 800,
    [stores[2].id]: 500,
  };

  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);
    const dateStr = date.toISOString().slice(0, 10);

    for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      let increment: number;

      if (i === 0) {
        increment = 130 + Math.random() * 20 - 10;
      } else if (i === 1) {
        if (dayOffset === 5) {
          increment = 250;
        } else if (dayOffset === 2) {
          increment = baseReadings[store.id] - 5;
        } else {
          increment = 100 + Math.random() * 20 - 10;
        }
      } else {
        if (dayOffset === 7 || dayOffset === 6) {
          increment = 180 + Math.random() * 20;
        } else {
          increment = 80 + Math.random() * 15 - 7;
        }
      }

      baseReadings[store.id] += increment;
      repo.insertMeterReading({
        storeId: store.id,
        date: dateStr,
        reading: Math.round(baseReadings[store.id] * 100) / 100,
        batchId: meterBatchId,
      });

      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      repo.insertBusinessHours({
        storeId: store.id,
        date: dateStr,
        openHour: 8,
        closeHour: isWeekend ? 22 : 20,
        batchId: hoursBatchId,
      });
    }
  }

  const cId = stores[2].id;
  const m1 = new Date(today); m1.setDate(m1.getDate() - 7);
  const m2 = new Date(today); m2.setDate(m2.getDate() - 6);

  repo.insertMaintenanceRecord({
    storeId: cId, date: m1.toISOString().slice(0, 10),
    type: "设备维修", description: "中央空调主机维修，全天测试运行",
    batchId: maintenanceBatchId,
  });
  repo.insertMaintenanceRecord({
    storeId: cId, date: m2.toISOString().slice(0, 10),
    type: "设备调试", description: "空调系统调试与校准",
    batchId: maintenanceBatchId,
  });

  repo.createImportBatch("readings", stores.length * 14, "success");
  repo.createImportBatch("hours", stores.length * 14, "success");
  repo.createImportBatch("maintenance", 2, "success");

  for (const s of stores) {
    import("./services.js").then(mod => {
      mod.recalculateAnomaliesForStore(s.id);
    });
  }

  console.log(`样例数据初始化完成：${stores.length}个门店，${stores.length * 14}条读数，2条维修记录`);
  return true;
}

export default seedSampleData;
