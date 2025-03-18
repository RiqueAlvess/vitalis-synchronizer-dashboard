
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

interface SocApiRequest {
  type: 'company' | 'employee' | 'absenteeism';
  params: Record<string, string>;
  configId?: number;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    // Get the session from the request
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado - Faça login para continuar' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle the request based on the method
    const { type, params, configId } = await req.json() as SocApiRequest
    
    console.log(`Processing ${type} API request`, params)
    
    // Create a log entry for this sync
    const { data: logData, error: logError } = await supabase
      .from('sync_logs')
      .insert({
        type,
        status: 'in_progress',
        message: `Sincronização de ${type} iniciada`,
        user_id: session.user.id
      })
      .select()

    if (logError) {
      console.error('Error creating sync log:', logError)
      return new Response(
        JSON.stringify({ error: 'Erro ao criar log de sincronização' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const logId = logData[0].id

    // Get the API configuration or use the provided params
    let apiParams = params
    
    if (configId) {
      const { data: configData, error: configError } = await supabase
        .from('api_configs')
        .select('*')
        .eq('id', configId)
        .eq('user_id', session.user.id)
        .single()
        
      if (configError) {
        await updateSyncLog(supabase, logId, 'error', 'Configuração de API não encontrada')
        return new Response(
          JSON.stringify({ error: 'Configuração de API não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Build the parameters based on the API type
      switch (type) {
        case 'company':
          apiParams = {
            empresa: configData.empresa,
            codigo: configData.codigo,
            chave: configData.chave,
            tipoSaida: configData.tipoSaida || 'json'
          }
          break
          
        case 'employee':
          apiParams = {
            empresa: configData.empresa,
            codigo: configData.codigo,
            chave: configData.chave,
            tipoSaida: configData.tipoSaida || 'json',
            ativo: configData.ativo || 'Sim',
            inativo: configData.inativo || '',
            afastado: configData.afastado || '',
            pendente: configData.pendente || '',
            ferias: configData.ferias || ''
          }
          break
          
        case 'absenteeism':
          apiParams = {
            empresa: configData.empresa,
            codigo: configData.codigo,
            chave: configData.chave,
            tipoSaida: configData.tipoSaida || 'json',
            empresaTrabalho: configData.empresaTrabalho || '',
            dataInicio: configData.dataInicio || '',
            dataFim: configData.dataFim || ''
          }
          break
          
        default:
          await updateSyncLog(supabase, logId, 'error', `Tipo de API inválido: ${type}`)
          return new Response(
            JSON.stringify({ error: 'Tipo de API inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
      }
    }

    // Make the API request to SOC
    const socApiUrl = 'https://ws1.soc.com.br/WebSoc/exportadados'
    const response = await fetch(`${socApiUrl}?parametro=${JSON.stringify(apiParams)}`)
    
    if (!response.ok) {
      const errorMessage = `Erro na API SOC: ${response.status} ${response.statusText}`
      await updateSyncLog(supabase, logId, 'error', errorMessage)
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Parse the response
    const textData = await response.text()
    const decodedData = new TextDecoder('latin1').decode(new TextEncoder().encode(textData))
    
    try {
      const jsonData = JSON.parse(decodedData)
      
      // Process the data based on the type
      let processingResult
      
      switch (type) {
        case 'company':
          processingResult = await processCompanyData(supabase, jsonData, session.user.id)
          break
          
        case 'employee':
          processingResult = await processEmployeeData(supabase, jsonData, session.user.id)
          break
          
        case 'absenteeism':
          processingResult = await processAbsenteeismData(supabase, jsonData, session.user.id)
          break
          
        default:
          await updateSyncLog(supabase, logId, 'error', `Tipo de API inválido: ${type}`)
          return new Response(
            JSON.stringify({ error: 'Tipo de API inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
      }
      
      // Update the sync log
      await updateSyncLog(
        supabase, 
        logId, 
        processingResult.success ? 'success' : 'error',
        processingResult.message,
        processingResult.error
      )
      
      return new Response(
        JSON.stringify(processingResult),
        { status: processingResult.success ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
      
    } catch (error) {
      const errorMessage = `Erro ao processar dados: ${error.message}`
      await updateSyncLog(supabase, logId, 'error', errorMessage)
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
  } catch (error) {
    console.error('Error processing request:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Helper function to update the sync log
async function updateSyncLog(
  supabase: any, 
  logId: number, 
  status: 'pending' | 'in_progress' | 'success' | 'error',
  message: string,
  errorDetails?: string
) {
  const updateData: any = {
    status,
    message,
    error_details: errorDetails
  }
  
  if (status === 'success' || status === 'error') {
    updateData.completed_at = new Date().toISOString()
  }
  
  const { error } = await supabase
    .from('sync_logs')
    .update(updateData)
    .eq('id', logId)
    
  if (error) {
    console.error('Error updating sync log:', error)
  }
}

// Process company data from the SOC API
async function processCompanyData(supabase: any, data: any, userId: string) {
  try {
    let successCount = 0
    let errorCount = 0
    const errors = []
    
    // Process each company
    for (const company of data) {
      try {
        // Check if the company already exists
        const { data: existingCompany } = await supabase
          .from('companies')
          .select('id')
          .eq('soc_code', company.CODIGO)
          .eq('user_id', userId)
          .maybeSingle()
          
        if (existingCompany) {
          // Update the company
          const { error } = await supabase
            .from('companies')
            .update({
              short_name: company.NOMEABREVIADO,
              corporate_name: company.RAZAOSOCIAL,
              initial_corporate_name: company.RAZAOSOCIALINICIAL,
              address: company.ENDERECO,
              address_number: company.NUMEROENDERECO,
              address_complement: company.COMPLEMENTOENDERECO,
              neighborhood: company.BAIRRO,
              city: company.CIDADE,
              zip_code: company.CEP,
              state: company.UF,
              tax_id: company.CNPJ,
              state_registration: company.INSCRICAOESTADUAL,
              municipal_registration: company.INSCRICAOMUNICIPAL,
              is_active: company.ATIVO === 1,
              integration_client_code: company.CODIGOCLIENTEINTEGRACAO,
              client_code: company['CÓD. CLIENTE'],
              updated_at: new Date().toISOString()
            })
            .eq('id', existingCompany.id)
            
          if (error) {
            errorCount++
            errors.push(`Erro ao atualizar empresa ${company.CODIGO}: ${error.message}`)
          } else {
            successCount++
          }
        } else {
          // Insert new company
          const { error } = await supabase
            .from('companies')
            .insert({
              soc_code: company.CODIGO,
              short_name: company.NOMEABREVIADO,
              corporate_name: company.RAZAOSOCIAL,
              initial_corporate_name: company.RAZAOSOCIALINICIAL,
              address: company.ENDERECO,
              address_number: company.NUMEROENDERECO,
              address_complement: company.COMPLEMENTOENDERECO,
              neighborhood: company.BAIRRO,
              city: company.CIDADE,
              zip_code: company.CEP,
              state: company.UF,
              tax_id: company.CNPJ,
              state_registration: company.INSCRICAOESTADUAL,
              municipal_registration: company.INSCRICAOMUNICIPAL,
              is_active: company.ATIVO === 1,
              integration_client_code: company.CODIGOCLIENTEINTEGRACAO,
              client_code: company['CÓD. CLIENTE'],
              user_id: userId
            })
            
          if (error) {
            errorCount++
            errors.push(`Erro ao inserir empresa ${company.CODIGO}: ${error.message}`)
          } else {
            successCount++
          }
        }
      } catch (error) {
        errorCount++
        errors.push(`Erro ao processar empresa ${company.CODIGO}: ${error.message}`)
      }
    }
    
    return {
      success: errorCount === 0,
      message: `Processamento de empresas concluído: ${successCount} com sucesso, ${errorCount} com erro`,
      error: errors.length > 0 ? errors.join('\n') : undefined,
      totalProcessed: successCount + errorCount,
      successCount,
      errorCount
    }
  } catch (error) {
    return {
      success: false,
      message: 'Erro ao processar dados de empresas',
      error: error.message,
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0
    }
  }
}

// Process employee data from the SOC API
async function processEmployeeData(supabase: any, data: any, userId: string) {
  try {
    let successCount = 0
    let errorCount = 0
    const errors = []
    
    // Process each employee
    for (const employee of data) {
      try {
        // Get the company ID
        const { data: companyData } = await supabase
          .from('companies')
          .select('id')
          .eq('soc_code', employee.CODIGOEMPRESA)
          .eq('user_id', userId)
          .maybeSingle()
          
        if (!companyData) {
          errorCount++
          errors.push(`Empresa não encontrada para o funcionário ${employee.CODIGO}`)
          continue
        }
        
        // Check if the employee already exists
        const { data: existingEmployee } = await supabase
          .from('employees')
          .select('id')
          .eq('soc_code', employee.CODIGO)
          .eq('company_soc_code', employee.CODIGOEMPRESA)
          .eq('user_id', userId)
          .maybeSingle()
          
        // Parse dates
        const birthDate = employee.DATA_NASCIMENTO ? new Date(employee.DATA_NASCIMENTO) : null
        const hireDate = employee.DATA_ADMISSAO ? new Date(employee.DATA_ADMISSAO) : null
        const terminationDate = employee.DATA_DEMISSAO ? new Date(employee.DATA_DEMISSAO) : null
        const lastUpdateDate = employee.DATAULTALTERACAO ? new Date(employee.DATAULTALTERACAO) : null
        
        const employeeData = {
          company_id: companyData.id,
          company_soc_code: employee.CODIGOEMPRESA,
          company_name: employee.NOMEEMPRESA,
          full_name: employee.NOME,
          unit_code: employee.CODIGOUNIDADE,
          unit_name: employee.NOMEUNIDADE,
          sector_code: employee.CODIGOSETOR,
          sector_name: employee.NOMESETOR,
          position_code: employee.CODIGOCARGO,
          position_name: employee.NOMECARGO,
          position_cbo: employee.CBOCARGO,
          cost_center: employee.CCUSTO,
          cost_center_name: employee.NOMECENTROCUSTO,
          employee_registration: employee.MATRICULAFUNCIONARIO,
          cpf: employee.CPF,
          rg: employee.RG,
          rg_state: employee.UFRG,
          rg_issuer: employee.ORGAOEMISSORRG,
          status: employee.SITUACAO,
          gender: employee.SEXO,
          pis: employee.PIS,
          work_card: employee.CTPS,
          work_card_series: employee.SERIECTPS,
          marital_status: employee.ESTADOCIVIL,
          contract_type: employee.TIPOCONTATACAO,
          birth_date: birthDate,
          hire_date: hireDate,
          termination_date: terminationDate,
          address: employee.ENDERECO,
          address_number: employee.NUMERO_ENDERECO,
          neighborhood: employee.BAIRRO,
          city: employee.CIDADE,
          state: employee.UF,
          zip_code: employee.CEP,
          home_phone: employee.TELEFONERESIDENCIAL,
          mobile_phone: employee.TELEFONECELULAR,
          email: employee.EMAIL,
          is_disabled: employee.DEFICIENTE === 1,
          disability_description: employee.DEFICIENCIA,
          mother_name: employee.NM_MAE_FUNCIONARIO,
          last_update_date: lastUpdateDate,
          hr_registration: employee.MATRICULARH,
          skin_color: employee.COR,
          education: employee.ESCOLARIDADE,
          birthplace: employee.NATURALIDADE,
          extension: employee.RAMAL,
          shift_regime: employee.REGIMEREVEZAMENTO,
          work_regime: employee.REGIMETRABALHO,
          commercial_phone: employee.TELCOMERCIAL,
          work_shift: employee.TURNOTRABALHO,
          hr_unit: employee.RHUNIDADE,
          hr_sector: employee.RHSETOR,
          hr_position: employee.RHCARGO,
          hr_cost_center_unit: employee.RHCENTROCUSTOUNIDADE,
          updated_at: new Date().toISOString()
        }
          
        if (existingEmployee) {
          // Update the employee
          const { error } = await supabase
            .from('employees')
            .update(employeeData)
            .eq('id', existingEmployee.id)
            
          if (error) {
            errorCount++
            errors.push(`Erro ao atualizar funcionário ${employee.CODIGO}: ${error.message}`)
          } else {
            successCount++
          }
        } else {
          // Insert new employee
          const { error } = await supabase
            .from('employees')
            .insert({
              ...employeeData,
              soc_code: employee.CODIGO,
              user_id: userId
            })
            
          if (error) {
            errorCount++
            errors.push(`Erro ao inserir funcionário ${employee.CODIGO}: ${error.message}`)
          } else {
            successCount++
          }
        }
      } catch (error) {
        errorCount++
        errors.push(`Erro ao processar funcionário ${employee.CODIGO}: ${error.message}`)
      }
    }
    
    return {
      success: errorCount === 0,
      message: `Processamento de funcionários concluído: ${successCount} com sucesso, ${errorCount} com erro`,
      error: errors.length > 0 ? errors.join('\n') : undefined,
      totalProcessed: successCount + errorCount,
      successCount,
      errorCount
    }
  } catch (error) {
    return {
      success: false,
      message: 'Erro ao processar dados de funcionários',
      error: error.message,
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0
    }
  }
}

// Process absenteeism data from the SOC API
async function processAbsenteeismData(supabase: any, data: any, userId: string) {
  try {
    let successCount = 0
    let errorCount = 0
    const errors = []
    
    // Process each absenteeism record
    for (const record of data) {
      try {
        // Get the company
        const { data: companyData } = await supabase
          .from('companies')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle()
          
        if (!companyData) {
          errorCount++
          errors.push('Empresa não encontrada para o registro de absenteísmo')
          continue
        }
        
        // Try to find the employee by registration
        let employeeId = null
        if (record.MATRICULA_FUNC) {
          const { data: employeeData } = await supabase
            .from('employees')
            .select('id')
            .eq('employee_registration', record.MATRICULA_FUNC)
            .eq('user_id', userId)
            .maybeSingle()
            
          if (employeeData) {
            employeeId = employeeData.id
          }
        }
        
        // Parse dates
        const birthDate = record.DT_NASCIMENTO ? new Date(record.DT_NASCIMENTO) : null
        const startDate = record.DT_INICIO_ATESTADO ? new Date(record.DT_INICIO_ATESTADO) : null
        const endDate = record.DT_FIM_ATESTADO ? new Date(record.DT_FIM_ATESTADO) : null
        
        // Insert the absenteeism record
        // Note: We always insert new records for absenteeism, as they represent unique events
        const { error } = await supabase
          .from('absenteeism')
          .insert({
            unit: record.UNIDADE,
            sector: record.SETOR,
            employee_registration: record.MATRICULA_FUNC,
            employee_id: employeeId,
            birth_date: birthDate,
            gender: record.SEXO,
            certificate_type: record.TIPO_ATESTADO,
            start_date: startDate,
            end_date: endDate,
            start_time: record.HORA_INICIO_ATESTADO,
            end_time: record.HORA_FIM_ATESTADO,
            days_absent: record.DIAS_AFASTADOS,
            hours_absent: record.HORAS_AFASTADO,
            primary_icd: record.CID_PRINCIPAL,
            icd_description: record.DESCRICAO_CID,
            pathological_group: record.GRUPO_PATOLOGICO,
            license_type: record.TIPO_LICENCA,
            company_id: companyData.id,
            user_id: userId
          })
          
        if (error) {
          errorCount++
          errors.push(`Erro ao inserir registro de absenteísmo: ${error.message}`)
        } else {
          successCount++
        }
      } catch (error) {
        errorCount++
        errors.push(`Erro ao processar registro de absenteísmo: ${error.message}`)
      }
    }
    
    return {
      success: errorCount === 0,
      message: `Processamento de absenteísmo concluído: ${successCount} com sucesso, ${errorCount} com erro`,
      error: errors.length > 0 ? errors.join('\n') : undefined,
      totalProcessed: successCount + errorCount,
      successCount,
      errorCount
    }
  } catch (error) {
    return {
      success: false,
      message: 'Erro ao processar dados de absenteísmo',
      error: error.message,
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0
    }
  }
}
