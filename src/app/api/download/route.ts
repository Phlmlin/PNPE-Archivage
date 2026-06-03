import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const docId = searchParams.get('id')

    if (!docId) {
      return NextResponse.json({ error: 'Identifiant du document manquant' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Récupérer le profil de l'utilisateur pour le filigrane
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, role, direction_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profil utilisateur non trouvé' }, { status: 403 })
    }

    // Récupérer le document (l'accès est filtré automatiquement par RLS)
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('title, file_path, file_size, file_type')
      .eq('id', docId)
      .single()

    if (docError || !document) {
      console.error('Erreur récupération document:', docError)
      return NextResponse.json({ error: 'Document non trouvé ou accès refusé' }, { status: 404 })
    }

    // Télécharger le fichier depuis le bucket de stockage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('archives-pnpe')
      .download(document.file_path)

    if (downloadError || !fileData) {
      console.error('Erreur téléchargement fichier:', downloadError)
      return NextResponse.json({ error: 'Fichier physique non trouvé' }, { status: 404 })
    }

    const arrayBuffer = await fileData.arrayBuffer()
    let fileBytes = Buffer.from(arrayBuffer)
    let isWatermarked = false

    // Appliquer le filigrane uniquement pour les fichiers PDF
    if (document.file_type === 'application/pdf' || document.file_path.toLowerCase().endsWith('.pdf')) {
      try {
        const pdfDoc = await PDFDocument.load(arrayBuffer)
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
        const pages = pdfDoc.getPages()
        
        const timestamp = new Date().toLocaleString('fr-GA', { timeZone: 'Africa/Libreville' })
        const watermarkText = `PNPE GABON - DOC CONFIDENTIEL - TELECHARGE PAR : ${profile.full_name.toUpperCase()} LE ${timestamp}`

        for (const page of pages) {
          const { width, height } = page.getSize()
          const fontSize = 8
          const textWidth = helveticaFont.widthOfTextAtSize(watermarkText, fontSize)
          
          // Positionner le texte en bas au milieu de la page
          const x = (width - textWidth) / 2
          const y = 15

          // Bande blanche de fond semi-transparente pour lisibilité du filigrane
          page.drawRectangle({
            x: 0,
            y: 0,
            width: width,
            height: 35,
            color: rgb(0.95, 0.95, 0.95),
            opacity: 0.85
          })

          // Dessiner le texte du filigrane
          page.drawText(watermarkText, {
            x,
            y,
            size: fontSize,
            font: helveticaFont,
            color: rgb(0.8, 0.1, 0.1), // Rouge administratif
            opacity: 0.9,
          })
        }

        const modifiedPdfBytes = await pdfDoc.save()
        fileBytes = Buffer.from(modifiedPdfBytes)
        isWatermarked = true
      } catch (pdfErr) {
        console.error('Erreur lors du filigranage du PDF (fallback vers fichier brut):', pdfErr)
      }
    }

    // Enregistrer l'événement de téléchargement dans le journal d'audit
    await logAuditEvent({
      action: 'document.download',
      resourceType: 'document',
      resourceId: docId,
      resourceLabel: document.title,
      metadata: {
        file_path: document.file_path,
        file_size: document.file_size,
        watermarked: isWatermarked,
      },
      supabaseClient: supabase,
    })

    const sanitizedFilename = document.title.replace(/[^a-zA-Z0-9]/g, '_')
    const extension = isWatermarked ? 'pdf' : (document.file_path.split('.').pop() || 'bin')

    return new NextResponse(fileBytes, {
      headers: {
        'Content-Type': isWatermarked ? 'application/pdf' : (document.file_type || 'application/octet-stream'),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(sanitizedFilename)}.${extension}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (err: any) {
    console.error('Erreur API route download:', err)
    return NextResponse.json({ error: 'Une erreur interne est survenue.' }, { status: 500 })
  }
}
