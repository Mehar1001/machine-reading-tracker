import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import * as Print from 'expo-print';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

const stores = [
  { id: 'xyz', name: 'XYZ', address: 'ANYTHING' },
  { id: 'abc', name: 'ABC', address: 'ANYTHING' },
  { id: 'pqr', name: 'PQR', address: 'ANYTHING' },
  { id: 'lmn', name: 'LMN', address: 'ANYTHING' },
  { id: 'def', name: 'DEF', address: 'ANYTHING' },
  { id: 'ghi', name: 'GHI', address: 'ANYTHING' },
];

const defaultLastReadings = [
  { machine: 'Machine 1', in: 1200, out: 800 },
  { machine: 'Machine 2', in: 900, out: 600 },
  { machine: 'Machine 3', in: 1100, out: 700 },
  { machine: 'Machine 4', in: 1300, out: 900 },
];

const employeeName = 'John Doe';

function money(n) {
  return Number(n || 0).toFixed(2);
}

function numberValue(value) {
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function nowLabel() {
  return new Date().toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function App() {
  const [screen, setScreen] = useState('stores');
  const [selectedStore, setSelectedStore] = useState(stores[0]);
  const [selectedDate, setSelectedDate] = useState('May 25, 2025');
  const [machineRows, setMachineRows] = useState([
    { machine: 'Machine 1', in: '1500', out: '1100', photo: null },
    { machine: 'Machine 2', in: '1200', out: '900', photo: null },
    { machine: 'Machine 3', in: '1400', out: '1000', photo: null },
    { machine: 'Machine 4', in: '1600', out: '1300', photo: null },
  ]);
  const [storePct, setStorePct] = useState('40');
  const [vendorPct, setVendorPct] = useState('60');
  const [history, setHistory] = useState([]);
  const [lastRun, setLastRun] = useState('May 25, 2025 08:45 AM');
  const [presentRun, setPresentRun] = useState(null);

  const totals = useMemo(() => {
    const totalIn = machineRows.reduce((sum, row) => sum + numberValue(row.in), 0);
    const totalOut = machineRows.reduce((sum, row) => sum + numberValue(row.out), 0);
    const net = totalIn - totalOut;
    return { totalIn, totalOut, net };
  }, [machineRows]);

  const isPositive = totals.net > 0;

  const updateMachine = (index, key, value) => {
    const updated = [...machineRows];
    updated[index] = { ...updated[index], [key]: value.replace(/[^0-9]/g, '') };
    setMachineRows(updated);
  };

  const chooseStore = (store) => {
    setSelectedStore(store);
    setScreen('details');
  };

  const locateMe = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Permission', 'Location permission was not granted.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      Alert.alert('Current Location', `Latitude: ${location.coords.latitude}\nLongitude: ${location.coords.longitude}`);
    } catch (e) {
      Alert.alert('Location Error', 'Unable to get current location.');
    }
  };

  const takePhoto = async (index) => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera Permission', 'Camera permission is required.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
      if (!result.canceled) {
        const updated = [...machineRows];
        updated[index].photo = result.assets?.[0]?.uri || null;
        setMachineRows(updated);
      }
    } catch (e) {
      Alert.alert('Camera Error', 'Unable to open camera.');
    }
  };

  const runStore = () => {
    const stamp = nowLabel();
    const run = {
      id: Date.now().toString(),
      dateTime: stamp,
      store: selectedStore.name,
      employee: employeeName,
      readings: machineRows.map((row) => ({ ...row, in: numberValue(row.in), out: numberValue(row.out) })),
      totalIn: totals.totalIn,
      totalOut: totals.totalOut,
      net: totals.net,
      status: totals.net >= 0 ? 'Positive' : 'Negative',
    };
    setPresentRun(run);
    setHistory((prev) => [run, ...prev]);
    setLastRun(stamp);
    if (totals.net > 0) {
      Alert.alert('Amounts are Positive', 'You can submit & print the report.');
    } else {
      Alert.alert('Negative Net Total', 'Only PRINT option is available. Submit & Print is disabled.');
    }
  };

  const printReport = async (submit = false) => {
    const html = buildReportHtml({ selectedStore, selectedDate, lastRun, machineRows, totals, storePct, vendorPct, submit });
    try {
      await Print.printAsync({ html });
    } catch (e) {
      Alert.alert('Print Error', 'Unable to print report.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.app}>
        <Sidebar screen={screen} setScreen={setScreen} />
        {screen === 'stores' && <StoresScreen chooseStore={chooseStore} locateMe={locateMe} />}
        {screen === 'details' && (
          <DetailsScreen
            store={selectedStore}
            locateMe={locateMe}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            machineRows={machineRows}
            updateMachine={updateMachine}
            takePhoto={takePhoto}
            totals={totals}
            isPositive={isPositive}
            runStore={runStore}
            printReport={printReport}
            setScreen={setScreen}
          />
        )}
        {screen === 'results' && (
          <ResultsScreen
            store={selectedStore}
            lastRun={lastRun}
            machineRows={machineRows}
            totals={totals}
            storePct={storePct}
            setStorePct={setStorePct}
            vendorPct={vendorPct}
            setVendorPct={setVendorPct}
            printReport={printReport}
          />
        )}
        {screen === 'history' && <HistoryScreen history={history} />}
      </View>
    </SafeAreaView>
  );
}

function Sidebar({ screen, setScreen }) {
  return (
    <View style={styles.sidebar}>
      <Text style={styles.menuIcon}>☰</Text>
      <TouchableOpacity style={[styles.sideTab, screen === 'stores' && styles.sideActive]} onPress={() => setScreen('stores')}>
        <Text style={styles.sideIcon}>🏪</Text>
        <Text style={styles.sideText}>STORES</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.sideTab, screen === 'history' && styles.sideActive]} onPress={() => setScreen('history')}>
        <Text style={styles.sideIcon}>↺</Text>
        <Text style={styles.sideText}>HISTORY</Text>
      </TouchableOpacity>
    </View>
  );
}

function Header({ title, locateMe, back }) {
  return (
    <View style={styles.header}>
      {back ? <TouchableOpacity onPress={back}><Text style={styles.back}>‹</Text></TouchableOpacity> : <View style={{ width: 25 }} />}
      <Text style={styles.headerTitle}>{title}</Text>
      <TouchableOpacity onPress={locateMe} style={styles.locate}><Text style={styles.locateText}>⌾ LOCATE ME</Text></TouchableOpacity>
    </View>
  );
}

function StoresScreen({ chooseStore, locateMe }) {
  return (
    <ScrollView style={styles.content}>
      <Header title="STORES" locateMe={locateMe} />
      {stores.map((store) => (
        <TouchableOpacity key={store.id} style={styles.storeCard} onPress={() => chooseStore(store)}>
          <Text style={styles.storeLogo}>🏪</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.storeName}>{store.name}</Text>
            <Text style={styles.address}>⌖ {store.address}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function StoreCard({ store }) {
  return (
    <View style={styles.detailCard}>
      <Text style={styles.label}>STORE NAME</Text>
      <Text style={styles.detailStore}>{store.name}</Text>
      <Text style={styles.address}>⌖ ADDRESS</Text>
      <Text style={styles.detailAddress}>{store.address}</Text>
    </View>
  );
}

function DetailsScreen(props) {
  const {
    store, locateMe, selectedDate, setSelectedDate, machineRows, updateMachine, takePhoto,
    totals, isPositive, runStore, printReport, setScreen,
  } = props;
  return (
    <ScrollView style={styles.content}>
      <Header title={`STORE ${store.name}`} locateMe={locateMe} back={() => setScreen('stores')} />
      <StoreCard store={store} />

      <Text style={styles.section}>DATE</Text>
      <View style={styles.dateRow}>
        <Text style={styles.calendarIcon}>📅</Text>
        <TextInput value={selectedDate} onChangeText={setSelectedDate} style={styles.dateInput} placeholder="Select date" />
        <TouchableOpacity style={styles.runSmall} onPress={runStore}><Text style={styles.runSmallText}>▶ RUN</Text></TouchableOpacity>
      </View>
      <Text style={styles.hint}>RUN records employee store visit and saves to History.</Text>

      <Text style={styles.section}>MACHINE DETAILS</Text>
      <View style={styles.tableHeader}>
        <Text style={styles.machineCol}>MACHINE</Text>
        <Text style={styles.inCol}>MACHINE IN</Text>
        <Text style={styles.outCol}>MACHINE OUT</Text>
        <Text style={styles.photoCol}>PHOTO</Text>
      </View>
      {machineRows.map((row, index) => (
        <View style={styles.machineRow} key={row.machine}>
          <Text style={styles.machineCol}>{row.machine.toUpperCase()}</Text>
          <TextInput keyboardType="numeric" value={row.in} onChangeText={(v) => updateMachine(index, 'in', v)} style={[styles.inputBox, styles.inBorder]} />
          <TextInput keyboardType="numeric" value={row.out} onChangeText={(v) => updateMachine(index, 'out', v)} style={[styles.inputBox, styles.outBorder]} />
          <TouchableOpacity style={styles.cameraBox} onPress={() => takePhoto(index)}><Text>📷</Text></TouchableOpacity>
        </View>
      ))}

      <View style={styles.totalRow}>
        <Text style={styles.totalGreen}>TOTAL IN {totals.totalIn}</Text>
        <Text style={styles.totalRed}>TOTAL OUT {totals.totalOut}</Text>
        <Text style={styles.totalBlue}>NET TOTAL {totals.net}</Text>
      </View>

      <View style={[styles.notice, isPositive ? styles.noticePositive : styles.noticeNegative]}>
        <Text style={styles.noticeIcon}>{isPositive ? '✅' : '⛔'}</Text>
        <View>
          <Text style={styles.noticeTitle}>{isPositive ? 'Amounts are Positive' : 'Net Total is Negative'}</Text>
          <Text style={styles.noticeText}>{isPositive ? 'You can submit & print the report.' : 'Submit & Print is disabled. Only print is available.'}</Text>
        </View>
      </View>

      {isPositive && (
        <TouchableOpacity style={styles.submitPrint} onPress={() => printReport(true)}>
          <Text style={styles.submitPrintText}>🖨 SUBMIT & PRINT</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.printButton} onPress={() => printReport(false)}>
        <Text style={styles.printText}>🖨 PRINT</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => setScreen('results')}>
        <Text style={styles.secondaryText}>VIEW RUN RESULTS</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function ResultsScreen({ store, lastRun, machineRows, totals, storePct, setStorePct, vendorPct, setVendorPct, printReport }) {
  const storeAmount = totals.net * (numberValue(storePct) / 100);
  const vendorAmount = totals.net * (numberValue(vendorPct) / 100);
  return (
    <ScrollView style={styles.content}>
      <View style={styles.header}><View style={{ width: 25 }} /><Text style={styles.headerTitle}>RUN RESULTS - STORE {store.name}</Text><View style={{ width: 95 }} /></View>
      <View style={styles.runDateCard}>
        <Text>📅 LAST RUN\n{lastRun}</Text>
        <Text>🕒 TODAY\n{nowLabel()}</Text>
      </View>
      <ReadingTable title="LAST READING" rows={defaultLastReadings} type="last" />
      <ReadingTable title="PRESENT READING" rows={machineRows.map(r => ({ machine: r.machine, in: numberValue(r.in), out: numberValue(r.out) }))} type="present" />
      <View style={styles.totalNet}><Text style={styles.totalNetLabel}>TOTAL NET</Text><Text style={styles.totalNetValue}>{totals.net}</Text></View>
      <View style={styles.percentRow}>
        <PercentBox title="STORE PERCENTAGE (%)" pct={storePct} setPct={setStorePct} amount={storeAmount} />
        <PercentBox title="VENDOR PERCENTAGE (%)" pct={vendorPct} setPct={setVendorPct} amount={vendorAmount} />
      </View>
      <TouchableOpacity style={styles.printButton} onPress={() => printReport(false)}><Text style={styles.printText}>🖨 PRINT REPORT</Text></TouchableOpacity>
    </ScrollView>
  );
}

function ReadingTable({ title, rows }) {
  return (
    <View style={styles.reportTable}>
      <Text style={styles.reportTitle}>{title}</Text>
      <View style={styles.reportRowHeader}>
        <Text style={styles.reportCell}>MACHINE</Text><Text style={styles.reportCellGreen}>IN</Text><Text style={styles.reportCellRed}>OUT</Text><Text style={styles.reportCellBlue}>NET TOTAL</Text>
      </View>
      {rows.map((row) => {
        const inValue = numberValue(row.in);
        const outValue = numberValue(row.out);
        return (
          <View key={row.machine} style={styles.reportRow}>
            <Text style={styles.reportCell}>{row.machine.toUpperCase()}</Text>
            <Text style={styles.reportCellGreen}>{inValue}</Text>
            <Text style={styles.reportCellRed}>{outValue}</Text>
            <Text style={styles.reportCellBlue}>{inValue - outValue}</Text>
          </View>
        );
      })}
    </View>
  );
}

function PercentBox({ title, pct, setPct, amount }) {
  return (
    <View style={styles.percentBox}>
      <Text style={styles.percentTitle}>{title}</Text>
      <View style={styles.percentInputWrap}>
        <TextInput value={pct} onChangeText={(v) => setPct(v.replace(/[^0-9]/g, ''))} keyboardType="numeric" style={styles.percentInput} />
        <Text>%</Text>
      </View>
      <View style={styles.calculatedBox}>
        <Text style={styles.calcLabel}>CALCULATED AMOUNT</Text>
        <Text style={styles.calcAmount}>{money(amount)}</Text>
      </View>
    </View>
  );
}

function HistoryScreen({ history }) {
  return (
    <ScrollView style={styles.content}>
      <View style={styles.header}><View style={{ width: 25 }} /><Text style={styles.headerTitle}>HISTORY</Text><View style={{ width: 95 }} /></View>
      <Text style={styles.section}>EMPLOYEE VISIT HISTORY</Text>
      <View style={styles.historyTable}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyCell}>DATE & TIME</Text><Text style={styles.historyCell}>STORE</Text><Text style={styles.historyCell}>EMPLOYEE</Text><Text style={styles.historyCell}>NET</Text><Text style={styles.historyCell}>STATUS</Text>
        </View>
        {history.length === 0 ? <Text style={styles.empty}>No visit history yet. Click RUN on a store.</Text> : history.map((item) => (
          <View style={styles.historyRow} key={item.id}>
            <Text style={styles.historyCell}>{item.dateTime}</Text><Text style={styles.historyCell}>{item.store}</Text><Text style={styles.historyCell}>{item.employee}</Text><Text style={[styles.historyCell, item.net >= 0 ? styles.greenText : styles.redText]}>{item.net}</Text><Text style={[styles.historyCell, item.status === 'Positive' ? styles.greenText : styles.redText]}>{item.status}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function buildReportHtml({ selectedStore, selectedDate, lastRun, machineRows, totals, storePct, vendorPct, submit }) {
  const rows = machineRows.map((r) => `<tr><td>${r.machine}</td><td>${numberValue(r.in)}</td><td>${numberValue(r.out)}</td><td>${numberValue(r.in) - numberValue(r.out)}</td></tr>`).join('');
  const storeAmount = totals.net * (numberValue(storePct) / 100);
  const vendorAmount = totals.net * (numberValue(vendorPct) / 100);
  return `
    <html><body style="font-family: Arial; padding: 24px;">
      <h1>Run Report - Store ${selectedStore.name}</h1>
      <p><b>Address:</b> ${selectedStore.address}</p>
      <p><b>Date:</b> ${selectedDate}</p>
      <p><b>Last Run:</b> ${lastRun}</p>
      <p><b>Submitted:</b> ${submit ? 'Yes' : 'No'}</p>
      <table border="1" cellspacing="0" cellpadding="8" width="100%">
        <tr><th>Machine</th><th>Present IN</th><th>Present OUT</th><th>Net Total</th></tr>
        ${rows}
      </table>
      <h2>Total IN: ${totals.totalIn}</h2>
      <h2>Total OUT: ${totals.totalOut}</h2>
      <h2>Total Net: ${totals.net}</h2>
      <p><b>Store Percentage:</b> ${storePct}% = ${money(storeAmount)}</p>
      <p><b>Vendor Percentage:</b> ${vendorPct}% = ${money(vendorAmount)}</p>
      <p><b>Status:</b> ${totals.net >= 0 ? 'Positive' : 'Negative'}</p>
    </body></html>`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  app: { flex: 1, flexDirection: 'row', backgroundColor: '#fff' },
  sidebar: { width: 82, backgroundColor: '#032a62', paddingTop: 18, alignItems: 'center' },
  menuIcon: { color: '#fff', fontSize: 28, marginBottom: 25 },
  sideTab: { width: '100%', paddingVertical: 14, alignItems: 'center' },
  sideActive: { backgroundColor: '#0754bd' },
  sideIcon: { fontSize: 23, color: '#fff' },
  sideText: { color: '#fff', fontWeight: '700', fontSize: 11, marginTop: 5 },
  content: { flex: 1, paddingHorizontal: 16, backgroundColor: '#fff' },
  header: { height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#071b47', textAlign: 'center', flex: 1 },
  locate: { width: 105, alignItems: 'flex-end' },
  locateText: { color: '#005be7', fontWeight: '800', fontSize: 12 },
  back: { fontSize: 36, color: '#071b47', width: 25 },
  storeCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cfe0ff', borderRadius: 9, padding: 14, marginBottom: 12, backgroundColor: '#fff' },
  storeLogo: { fontSize: 30, marginRight: 12 },
  storeName: { fontSize: 21, fontWeight: '800', color: '#071b47' },
  address: { color: '#3a455d', fontSize: 13, marginTop: 5 },
  arrow: { fontSize: 30, color: '#071b47' },
  detailCard: { borderWidth: 1, borderColor: '#e0e5ef', borderRadius: 9, padding: 16, marginBottom: 14 },
  label: { fontSize: 12, color: '#071b47', fontWeight: '800' },
  detailStore: { fontSize: 28, color: '#071b47', fontWeight: '900', marginBottom: 12 },
  detailAddress: { fontSize: 16, color: '#3a455d', fontWeight: '700' },
  section: { color: '#005be7', fontSize: 15, fontWeight: '900', marginBottom: 8, marginTop: 8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  calendarIcon: { fontSize: 20, marginRight: 6 },
  dateInput: { borderWidth: 1, borderColor: '#b9c4d6', borderRadius: 7, height: 42, paddingHorizontal: 10, flex: 1 },
  runSmall: { backgroundColor: '#005be7', borderRadius: 7, height: 42, paddingHorizontal: 18, justifyContent: 'center', marginLeft: 8 },
  runSmallText: { color: '#fff', fontWeight: '900' },
  hint: { fontSize: 12, color: '#526078', textAlign: 'right', marginBottom: 12 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  machineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  machineCol: { flex: 1.1, fontSize: 12, color: '#071b47', fontWeight: '800' },
  inCol: { flex: 1.1, fontSize: 12, color: 'green', fontWeight: '900' },
  outCol: { flex: 1.1, fontSize: 12, color: 'red', fontWeight: '900' },
  photoCol: { width: 55, fontSize: 12, color: '#071b47', fontWeight: '800', textAlign: 'center' },
  inputBox: { flex: 1.1, borderWidth: 1, borderRadius: 7, height: 42, marginHorizontal: 5, textAlign: 'center', fontWeight: '700' },
  inBorder: { borderColor: '#89c695' },
  outBorder: { borderColor: '#ff9797' },
  cameraBox: { width: 45, height: 42, borderWidth: 1, borderColor: '#6da4ff', borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  totalRow: { flexDirection: 'row', borderWidth: 1, borderColor: '#d4dcea', borderRadius: 7, padding: 11, justifyContent: 'space-between', marginVertical: 8 },
  totalGreen: { color: 'green', fontWeight: '900', fontSize: 12 },
  totalRed: { color: 'red', fontWeight: '900', fontSize: 12 },
  totalBlue: { color: '#005be7', fontWeight: '900', fontSize: 12 },
  notice: { flexDirection: 'row', borderWidth: 1, borderRadius: 7, padding: 12, alignItems: 'center', marginVertical: 8 },
  noticePositive: { borderColor: '#51aa61', backgroundColor: '#f2fff4' },
  noticeNegative: { borderColor: '#d44242', backgroundColor: '#fff3f3' },
  noticeIcon: { fontSize: 22, marginRight: 10 },
  noticeTitle: { fontWeight: '900', color: '#071b47' },
  noticeText: { color: '#071b47', fontSize: 13, marginTop: 2 },
  submitPrint: { backgroundColor: '#088d28', borderRadius: 7, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  submitPrintText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  printButton: { borderWidth: 1, borderColor: '#0062ff', borderRadius: 7, height: 52, alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
  printText: { color: '#005be7', fontWeight: '900', fontSize: 17 },
  secondaryButton: { alignItems: 'center', paddingBottom: 25 },
  secondaryText: { color: '#071b47', fontWeight: '900' },
  runDateCard: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#eef5ff', borderRadius: 7, padding: 12, marginBottom: 14 },
  reportTable: { borderWidth: 1, borderColor: '#d9e0ea', borderRadius: 7, overflow: 'hidden', marginBottom: 12 },
  reportTitle: { textAlign: 'center', fontWeight: '900', backgroundColor: '#fff4d8', padding: 10, color: '#352600' },
  reportRowHeader: { flexDirection: 'row', backgroundColor: '#f7faff', paddingVertical: 9 },
  reportRow: { flexDirection: 'row', paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#e8edf5' },
  reportCell: { flex: 1, textAlign: 'center', fontWeight: '800', color: '#071b47', fontSize: 12 },
  reportCellGreen: { flex: 1, textAlign: 'center', fontWeight: '900', color: 'green', fontSize: 12 },
  reportCellRed: { flex: 1, textAlign: 'center', fontWeight: '900', color: 'red', fontSize: 12 },
  reportCellBlue: { flex: 1, textAlign: 'center', fontWeight: '900', color: '#005be7', fontSize: 12 },
  totalNet: { flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: '#bdd7ff', borderRadius: 7, padding: 12, marginBottom: 12, backgroundColor: '#f6faff' },
  totalNetLabel: { color: '#005be7', fontWeight: '900' },
  totalNetValue: { color: '#005be7', fontWeight: '900', fontSize: 22 },
  percentRow: { flexDirection: 'row', gap: 10 },
  percentBox: { flex: 1, borderWidth: 1, borderColor: '#e0e5ef', borderRadius: 7, padding: 10 },
  percentTitle: { fontWeight: '900', fontSize: 11, color: '#071b47', marginBottom: 8 },
  percentInputWrap: { borderWidth: 1, borderColor: '#c6cfdd', borderRadius: 6, height: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  percentInput: { flex: 1, fontWeight: '800' },
  calculatedBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e0e5ef', borderRadius: 6, alignItems: 'center', padding: 9, marginTop: 8 },
  calcLabel: { fontWeight: '800', color: '#071b47', fontSize: 10 },
  calcAmount: { fontWeight: '900', color: 'green', fontSize: 18, marginTop: 4 },
  historyTable: { borderWidth: 1, borderColor: '#d9e0ea', borderRadius: 7, overflow: 'hidden' },
  historyHeader: { flexDirection: 'row', backgroundColor: '#f7faff', paddingVertical: 10 },
  historyRow: { flexDirection: 'row', paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#e8edf5' },
  historyCell: { flex: 1, fontSize: 10, color: '#071b47', textAlign: 'center' },
  greenText: { color: 'green', fontWeight: '900' },
  redText: { color: 'red', fontWeight: '900' },
  empty: { padding: 18, textAlign: 'center', color: '#526078' },
});
