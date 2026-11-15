import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { parseSolesToCentavos, formatMoneda, type Centavos } from '@tienda/business-logic';
import { generateIdempotencyKey } from '@tienda/sync-engine';

export default function App(): React.JSX.Element {
  const [demoAmount, setDemoAmount] = useState<Centavos>(1990 as Centavos); // S/ 19.90
  const [lastHash, setLastHash] = useState<string>('');

  const handleTestIdempotency = () => {
    const key = generateIdempotencyKey({
      dispositivoId: 'demo-mobile-device-01',
      entityType: 'ventas',
      entityId: 'demo-sale-uuid',
      operation: 'INSERT',
      timestamp: new Date().toISOString(),
      payload: { totalNeto: demoAmount },
    });
    setLastHash(key);
  };

  const handleAddSample = () => {
    const parsed = parseSolesToCentavos('12.50');
    if (parsed.ok) {
      setDemoAmount((prev) => (prev + parsed.value) as Centavos);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Sistema de Gestión de Librería</Text>
        <Text style={styles.subtitle}>Proyecto Tienda — Base Offline-First (H06)</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Estado de Infraestructura Técnica</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusDot}>●</Text>
            <Text style={styles.statusText}>Persistencia: SQLite WAL (synchronous = FULL)</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusDot}>●</Text>
            <Text style={styles.statusText}>Cola Outbox: Integración local sin red</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusDot}>●</Text>
            <Text style={styles.statusText}>Aritmética Monetaria: Céntimos enteros (Exacto)</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusDot}>●</Text>
            <Text style={styles.statusText}>Idempotencia: Deduplicación SHA-256</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Verificación Aritmética de Mostrador</Text>
          <Text style={styles.amountDisplay}>{formatMoneda(demoAmount)}</Text>
          <Text style={styles.centsInfo}>Valor interno en memoria: {demoAmount} céntimos</Text>

          <TouchableOpacity style={styles.button} onPress={handleAddSample} activeOpacity={0.8}>
            <Text style={styles.buttonText}>+ Sumar S/ 12.50 (1250 céntimos)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Generador de Claves de Idempotencia</Text>
          <TouchableOpacity style={styles.buttonSecondary} onPress={handleTestIdempotency} activeOpacity={0.8}>
            <Text style={styles.buttonTextSecondary}>Generar Hash SHA-256 de Mutación</Text>
          </TouchableOpacity>
          {lastHash ? (
            <View style={styles.hashBox}>
              <Text style={styles.hashLabel}>Última Clave de Idempotencia:</Text>
              <Text style={styles.hashText} numberOfLines={2} ellipsizeMode="middle">
                {lastHash}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    color: '#10b981',
    fontSize: 14,
  },
  statusText: {
    fontSize: 13,
    color: '#334155',
  },
  amountDisplay: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0284c7',
    textAlign: 'center',
    marginVertical: 4,
  },
  centsInfo: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonTextSecondary: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  hashBox: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 6,
  },
  hashLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 2,
  },
  hashText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#0f172a',
  },
});
