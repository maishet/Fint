import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Plus, RefreshCw, Save, Trash2 } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Paragraph, Spinner, XStack, YStack } from 'tamagui'
import { financeApi } from '../src/api/finance'
import type { GmailSource } from '../src/api/types'
import { DataStateCard } from '../src/components/DataStateCard'
import { Screen } from '../src/components/Screen'
import { FintButton, FintCard, FintInput } from '../src/ui'

export default function GmailSettingsScreen() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const sourcesQuery = useQuery({ queryKey: ['gmail-sources'], queryFn: financeApi.listGmailSources, retry: false })
  const connectMutation = useMutation({
    mutationFn: async () => {
      const { authUrl } = await financeApi.startGmailOAuth()
      return WebBrowser.openAuthSessionAsync(authUrl, 'finanzasmobilev2://gmail-connected')
    },
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['gmail-sources'] }), queryClient.invalidateQueries({ queryKey: ['me'] })])
    },
  })
  const connect = () => connectMutation.mutate()
  const visibleSources = (sourcesQuery.data ?? []).filter((source) => source.status === 'active' || source.status === 'error')

  return (
    <Screen isRefreshing={sourcesQuery.isRefetching} onRefresh={() => sourcesQuery.refetch()}>
      <FintCard bg="#0F5D73" borderColor="#28788C" gap="$3">
        <XStack items="center" gap="$3"><YStack width={48} height={48} rounded="$10" bg="rgba(93,214,229,0.14)" items="center" justify="center"><Mail size={24} color="#5DD6E5" /></YStack><YStack flex={1}><Paragraph color="#F4FBFD" fontFamily="$heading" fontSize="$6" fontWeight="800">{t('gmail.title')}</Paragraph><Paragraph color="#B9D7E1">{t('gmail.description')}</Paragraph></YStack></XStack>
        <FintButton bg="#5DD6E5" color="#062536" disabled={connectMutation.isPending || visibleSources.filter((source) => source.status === 'active').length >= 3} icon={connectMutation.isPending ? <Spinner /> : <Plus size={18} />} onPress={connect}>{t('gmail.connect')}</FintButton>
      </FintCard>
      {sourcesQuery.isLoading ? <DataStateCard message={t('states.loading')} /> : null}
      {sourcesQuery.error ? <DataStateCard message={sourcesQuery.error instanceof Error ? sourcesQuery.error.message : t('states.error')} onRetry={() => { void sourcesQuery.refetch() }} /> : null}
      {visibleSources.map((source) => <GmailSourceCard key={source.id} source={source} onReconnect={connect} />)}
      {!sourcesQuery.isLoading && visibleSources.length === 0 ? <DataStateCard message={t('gmail.empty')} /> : null}
    </Screen>
  )
}

function GmailSourceCard({ onReconnect, source }: { onReconnect: () => void; source: GmailSource }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const toast = useToastController()
  const [senders, setSenders] = useState(source.senderFilters.join(', '))
  const syncMutation = useMutation({ mutationFn: () => financeApi.syncGmailSource(source.id), onSuccess: (result) => { queryClient.invalidateQueries({ queryKey: ['pending-movements'] }); queryClient.invalidateQueries({ queryKey: ['gmail-sources'] }); toast.show(t('gmail.syncComplete'), { message: `${result.processed} procesados · ${result.created} nuevos`, preset: 'success' }) } })
  const saveMutation = useMutation({ mutationFn: () => financeApi.updateGmailSource(source.id, { labelIds: ['INBOX'], senderFilters: senders.split(/[\n,;]+/).map((value) => value.trim().toLowerCase()).filter(Boolean) }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gmail-sources'] }) })
  const deleteMutation = useMutation({ mutationFn: () => financeApi.disconnectGmailSource(source.id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gmail-sources'] }); queryClient.invalidateQueries({ queryKey: ['me'] }) } })
  const pending = syncMutation.isPending || saveMutation.isPending || deleteMutation.isPending
  const confirmDisconnect = () => Alert.alert(t('gmail.disconnect'), t('gmail.disconnectConfirm', { defaultValue: 'La cuenta Gmail se desconectara. Tus movimientos confirmados se conservaran.' }), [{ text: t('actions.cancel'), style: 'cancel' }, { text: t('gmail.disconnect'), style: 'destructive', onPress: () => deleteMutation.mutate() }])

  return (
    <FintCard gap="$4">
      <XStack items="center" gap="$3"><YStack width={40} height={40} rounded="$9" bg="$secondary" items="center" justify="center"><Mail size={20} color="$primary" /></YStack><YStack flex={1}><Paragraph color="$color12" fontWeight="800">{source.emailAddress}</Paragraph><Paragraph color="$color10" fontSize="$1">{source.lastSyncAt ? t('gmail.lastSync', { date: new Date(source.lastSyncAt).toLocaleString() }) : t('gmail.notSynced')}</Paragraph></YStack></XStack>
      {source.status === 'error' ? <YStack bg="$red2" borderColor="$red6" borderWidth={1} rounded="$5" p="$3" gap="$2"><Paragraph color="$red11" fontWeight="700">{t('gmail.reconnectRequired')}</Paragraph><FintButton size="$3" variant="outlined" color="$red10" borderColor="$red6" onPress={onReconnect}>{t('gmail.reconnect')}</FintButton></YStack> : null}
      <YStack gap="$2"><Paragraph color="$color10" fontWeight="700">{t('gmail.senders')}</Paragraph><Paragraph color="$color10" fontSize="$1">{t('gmail.sendersHelp')}</Paragraph><FintInput multiline minH={88} textAlignVertical="top" placeholder="alertas@banco.com, pagos@tienda.com" value={senders} onChangeText={setSenders} /></YStack>
      <XStack gap="$2"><FintButton flex={1} variant="outlined" disabled={pending || source.status === 'error'} icon={syncMutation.isPending ? <Spinner size="small" /> : <RefreshCw size={16} />} onPress={() => syncMutation.mutate()}>{syncMutation.isPending ? t('gmail.syncing') : t('gmail.sync')}</FintButton><FintButton flex={1} disabled={pending || source.status === 'error'} icon={<Save size={16} />} onPress={() => saveMutation.mutate()}>{t('actions.save')}</FintButton></XStack>
      <FintButton variant="outlined" color="$red10" borderColor="$red6" disabled={pending} icon={<Trash2 size={16} />} onPress={confirmDisconnect}>{t('gmail.disconnect')}</FintButton>
    </FintCard>
  )
}
