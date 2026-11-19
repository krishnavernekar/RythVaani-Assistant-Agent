import React from 'react';
import { CropScannerModal } from '../components/CropScannerModal';
import { useNavigation } from '@react-navigation/native';

export default function CropScannerScreen() {
  const navigation = useNavigation<any>();
  return <CropScannerModal visible={true} onClose={() => navigation.goBack()} />;
}
